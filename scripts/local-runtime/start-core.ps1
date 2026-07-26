[CmdletBinding()]
param(
    [switch]$SkipDocker,
    [switch]$SkipGenerate,
    [switch]$ReuseOnly,
    [string]$RepositoryRoot,
    [string]$ExpectedCommit,
    [string]$StatePath,
    [int]$ApiPort = 4000,
    [int]$FrontendPort = 4175,
    [int]$SpeechPort = 8100
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'runtime-common.ps1')
if ($RepositoryRoot) { $rootDir = [System.IO.Path]::GetFullPath($RepositoryRoot) } else { $rootDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot) }
if (-not $ExpectedCommit) { $ExpectedCommit = ([string](git -C $rootDir rev-parse HEAD)).Trim() }
$envFile = Join-Path $rootDir '.env'
$runtimeDir = Join-Path $rootDir 'runtime-local\local-runtime'
$manifestPath = if ($StatePath) { [IO.Path]::GetFullPath($StatePath) } else { Join-Path $runtimeDir 'process-manifest.json' }
$logDir = Join-Path $runtimeDir 'logs'
$started = [System.Collections.Generic.List[System.Diagnostics.Process]]::new()
$mutex = [Threading.Mutex]::new($false, 'YuzanCanonicalRuntimeStart')

function Import-EnvFile([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { throw "Missing environment file: $Path. Copy .env.example to .env first." }
    foreach ($rawLine in Get-Content -LiteralPath $Path -Encoding UTF8) {
        $line = $rawLine.Trim()
        if (-not $line -or $line.StartsWith('#')) { continue }
        $separator = $line.IndexOf('=')
        if ($separator -le 0) { continue }
        $key = $line.Substring(0, $separator).Trim()
        $value = $line.Substring($separator + 1).Trim().Trim('"')
        [Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
}

function Start-AttestedProcess {
    param([string]$Name, [string[]]$ChildCommand, [string]$WorkingDirectory, [AllowNull()][Nullable[int]]$Port, [string]$Nonce, [string]$Commit)
    $stdout = Join-Path $logDir "$Name.stdout.log"
    $stderr = Join-Path $logDir "$Name.stderr.log"
    $wrapperScript = Join-Path $PSScriptRoot 'managed-process.py'
    $attestationDir = Join-Path $runtimeDir 'attestations'
    $commandJson = $ChildCommand | ConvertTo-Json -Compress
    $commandBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($commandJson))
    $wrapperArguments = @($wrapperScript, '--role', $Name, '--attestation-dir', $attestationDir, '--nonce', $Nonce,
        '--repository-root', $rootDir, '--commit', $Commit, '--command-base64', $commandBase64)
    $process = Start-Process -FilePath $python.Source -ArgumentList $wrapperArguments -WorkingDirectory $WorkingDirectory `
        -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    $started.Add($process)
    $record = New-ManagedProcessRecord -Name $Name -WrapperProcess $process `
        -AttestationPath (Join-Path $attestationDir "$Name.json") -LockPath (Join-Path $attestationDir "$Name.lock") `
        -WrapperScript $wrapperScript -CommandArgvSha256 (Get-TextSha256 $commandJson) -Port $Port
    [pscustomobject]@{ process = $process; record = $record }
}

function Wait-Ready([string]$Url, [System.Diagnostics.Process]$Process, [string]$Name) {
    for ($attempt = 1; $attempt -le 60; $attempt++) {
        if ($Process.HasExited) { throw "$Name exited during startup with code $($Process.ExitCode)." }
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ([int]$response.StatusCode -eq 200 -and $response.Content -match '"status"\s*:\s*"ok"') { return }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    throw "$Name did not become healthy: $Url"
}

$lockTaken = $false
try {
    $lockTaken = $mutex.WaitOne([TimeSpan]::FromSeconds(30))
    if (-not $lockTaken) { throw 'Another canonical runtime start owns the startup lock.' }

    $statusScript = Join-Path $PSScriptRoot 'get-runtime-status.ps1'
    $initialStatus = & $statusScript -RepositoryRoot $rootDir -ExpectedCommit $ExpectedCommit -StatePath $manifestPath `
        -ApiPort $ApiPort -FrontendPort $FrontendPort -SpeechPort $SpeechPort
    if ($initialStatus.all_ready) {
        Write-Host "[OK] Reusing exact-commit runtime $ExpectedCommit on ports $ApiPort/$FrontendPort/$SpeechPort." -ForegroundColor Green
        $initialStatus | ConvertTo-Json -Depth 10
        return
    }
    if ($initialStatus.any_service_detected) {
        throw "Unowned, partial, unhealthy, or wrong-commit runtime detected. No process was stopped and no alternate port will be selected. Diagnostic: $($initialStatus | ConvertTo-Json -Depth 10 -Compress)"
    }
    if ($ReuseOnly) {
        throw "No exact-commit managed runtime is reusable. ReuseOnly forbids launching or changing ports. Diagnostic: $($initialStatus | ConvertTo-Json -Depth 10 -Compress)"
    }
    if ($ApiPort -ne 4000 -or $FrontendPort -ne 4175 -or $SpeechPort -ne 8100) {
        throw 'Managed runtime launch is restricted to fixed ports 4000/4175/8100.'
    }

    Push-Location $rootDir
    try { fnm env --shell powershell | Invoke-Expression } finally { Pop-Location }
    Repair-ProcessPathEnvironment
    Import-EnvFile $envFile
    $node = Get-Command node -ErrorAction Stop
    $python = Get-Command python -ErrorAction Stop
    $nodeMajor = [int]((& $node.Source --version).TrimStart('v').Split('.')[0])
    if ($nodeMajor -lt 24 -or $nodeMajor -ge 27) { throw "Node 24-26 is required; current version is $(& $node.Source --version)." }

    Push-Location $rootDir
    try {
        docker compose config --quiet
        if (-not $SkipDocker) { docker compose up -d minio redis }
        $database = [Uri]$env:DATABASE_URL
        $tcp = [Net.Sockets.TcpClient]::new()
        try { $tcp.Connect($database.Host, $database.Port) } finally { $tcp.Dispose() }
        if (-not $SkipGenerate) { pnpm db:generate }
        pnpm --filter @yuzan/database build
        pnpm --filter @yuzan/api build
        pnpm --filter @yuzan/worker build
    } finally { Pop-Location }

    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    $nonce = [Guid]::NewGuid().ToString('N')
    $attestation = @(
        "--yuzan-runtime-nonce=$nonce",
        "--yuzan-runtime-root=$rootDir",
        "--yuzan-runtime-commit=$ExpectedCommit"
    )
    $speechArgs = @((Join-Path $PSScriptRoot 'managed-speech.py'), '--host', '127.0.0.1', '--port', '8100') + $attestation
    $apiArgs = @((Join-Path $rootDir 'backend\api\dist\main.js')) + $attestation
    $frontendArgs = @((Join-Path $rootDir 'frontend\server.mjs')) + $attestation
    $workerArgs = @((Join-Path $rootDir 'backend\worker\dist\main.js')) + $attestation

    $speech = Start-AttestedProcess -Name 'speech' -ChildCommand (@($python.Source) + $speechArgs) -WorkingDirectory $rootDir -Port 8100 -Nonce $nonce -Commit $ExpectedCommit
    $api = Start-AttestedProcess -Name 'api' -ChildCommand (@($node.Source) + $apiArgs) -WorkingDirectory $rootDir -Port 4000 -Nonce $nonce -Commit $ExpectedCommit
    $frontend = Start-AttestedProcess -Name 'frontend_proxy' -ChildCommand (@($node.Source) + $frontendArgs) -WorkingDirectory $rootDir -Port 4175 -Nonce $nonce -Commit $ExpectedCommit
    $worker = Start-AttestedProcess -Name 'worker' -ChildCommand (@($node.Source) + $workerArgs) -WorkingDirectory $rootDir -Port $null -Nonce $nonce -Commit $ExpectedCommit

    $manifest = [ordered]@{
        schema_version = 2
        nonce = $nonce
        repository_root = $rootDir
        commit = $ExpectedCommit
        started_at = [DateTime]::UtcNow.ToString('o')
        ports = [ordered]@{ api = 4000; frontend = 4175; speech = 8100 }
        services = [ordered]@{ api = $api.record; frontend_proxy = $frontend.record; speech = $speech.record; worker = $worker.record }
    }
    Write-JsonAtomic -Path $manifestPath -Value $manifest
    Wait-Ready 'http://127.0.0.1:8100/health' $speech.process 'speech'
    Wait-Ready 'http://127.0.0.1:4000/api/v1/health/ready' $api.process 'api'
    Wait-Ready 'http://127.0.0.1:4175/api/v1/health/ready' $frontend.process 'frontend proxy'
    $finalStatus = & $statusScript -RepositoryRoot $rootDir -ExpectedCommit $ExpectedCommit -StatePath $manifestPath
    if (-not $finalStatus.all_ready) { throw "Started runtime failed ownership/commit attestation: $($finalStatus | ConvertTo-Json -Depth 10 -Compress)" }
    Write-Host "[OK] Started exact-commit runtime $ExpectedCommit. Manifest: $manifestPath" -ForegroundColor Green
    $finalStatus | ConvertTo-Json -Depth 10
    $started.Clear()
} catch {
    foreach ($process in $started) {
        if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
    }
    if ($started.Count -gt 0 -and (Test-Path -LiteralPath $manifestPath)) { Remove-Item -LiteralPath $manifestPath -Force -ErrorAction SilentlyContinue }
    throw
} finally {
    if ($lockTaken) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
