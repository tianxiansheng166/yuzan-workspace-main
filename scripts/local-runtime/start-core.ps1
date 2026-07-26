param(
    [switch]$SkipDocker,
    [switch]$SkipGenerate
)

$ErrorActionPreference = 'Stop'
$rootDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envFile = Join-Path $rootDir '.env'

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

    pnpm dev
} finally {
    Pop-Location
}
