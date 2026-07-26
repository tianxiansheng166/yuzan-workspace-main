param(
    [switch]$SkipDocker,
    [switch]$SkipGenerate
)

$ErrorActionPreference = 'Stop'
$rootDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envFile = Join-Path $rootDir '.env'
$speechProcess = $null
$ownsSpeechProcess = $false

function Import-EnvFile([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Missing environment file: $Path. Copy .env.example to .env first."
    }

    foreach ($rawLine in Get-Content -LiteralPath $Path) {
        $line = $rawLine.Trim()
        if (-not $line -or $line.StartsWith('#')) { continue }
        $separator = $line.IndexOf('=')
        if ($separator -le 0) { continue }
        $key = $line.Substring(0, $separator).Trim()
        $value = $line.Substring($separator + 1).Trim().Trim('"')
        [Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
}

Push-Location $rootDir
try {
    fnm env --shell powershell | Invoke-Expression
} finally {
    Pop-Location
}

Import-EnvFile $envFile

$nodeMajor = [int]((node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 24 -or $nodeMajor -ge 27) {
    throw "Node 24-26 is required; current version is $(node --version)."
}

Push-Location $rootDir
try {
    docker compose config --quiet
    if (-not $SkipDocker) {
        docker compose up -d minio redis
    }

    $database = [Uri]$env:DATABASE_URL
    $tcp = [Net.Sockets.TcpClient]::new()
    try {
        $tcp.Connect($database.Host, $database.Port)
    } finally {
        $tcp.Dispose()
    }

    if (-not $SkipGenerate) {
        pnpm db:generate
    }

    # The API imports the compiled database workspace package. Generate alone updates
    # Prisma source but leaves that package's declaration output stale after schema changes.
    pnpm --filter @yuzan/database build

    $speechHealthUrl = 'http://127.0.0.1:8100/health'
    $speechListener = Get-NetTCPConnection -State Listen -LocalPort 8100 -ErrorAction SilentlyContinue
    if ($speechListener) {
        try {
            $null = Invoke-WebRequest -Uri $speechHealthUrl -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
            Write-Host '[OK] Reusing healthy speech scoring service on 127.0.0.1:8100' -ForegroundColor Green
        } catch {
            throw 'Port 8100 is occupied but the speech scoring health check failed.'
        }
    } else {
        $pythonCommand = Get-Command python -ErrorAction Stop
        $speechDir = Join-Path $rootDir 'backend\speech-scoring'
        $speechProcess = Start-Process -FilePath $pythonCommand.Source `
            -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8100') `
            -WorkingDirectory $speechDir -WindowStyle Hidden -PassThru
        $ownsSpeechProcess = $true

        $speechReady = $false
        for ($attempt = 1; $attempt -le 40; $attempt++) {
            if ($speechProcess.HasExited) {
                throw "Speech scoring exited during startup with code $($speechProcess.ExitCode)."
            }
            try {
                $null = Invoke-WebRequest -Uri $speechHealthUrl -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
                $speechReady = $true
                break
            } catch {
                Start-Sleep -Milliseconds 500
            }
        }
        if (-not $speechReady) {
            throw 'Speech scoring did not become healthy on 127.0.0.1:8100.'
        }
        Write-Host '[OK] Speech scoring started on 127.0.0.1:8100' -ForegroundColor Green
    }

    pnpm dev
} finally {
    if ($ownsSpeechProcess -and $speechProcess -and -not $speechProcess.HasExited) {
        Stop-Process -Id $speechProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Pop-Location
}
