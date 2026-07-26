[CmdletBinding()]
param(
    [string]$RepositoryRoot,
    [string]$ExpectedCommit,
    [string]$StatePath,
    [int]$ApiPort = 4000,
    [int]$FrontendPort = 4175,
    [int]$SpeechPort = 8100
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'runtime-common.ps1')
if (-not $RepositoryRoot) { $RepositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path }
$rootDir = [System.IO.Path]::GetFullPath($RepositoryRoot)
if (-not $ExpectedCommit) { $ExpectedCommit = ([string](git -C $rootDir rev-parse HEAD)).Trim() }
if (-not $StatePath) { $StatePath = Join-Path $rootDir 'runtime-local\local-runtime\process-manifest.json' }

function Get-ListenerPids([int]$Port) {
    $pids = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique)
    if ($pids.Count -eq 0) {
        foreach ($line in @(netstat -ano -p tcp 2>$null)) {
            if ($line -match "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$") { $pids += [int]$Matches[1] }
        }
    }
    @($pids | Sort-Object -Unique)
}

function Test-Health([string]$Url, [string]$ExpectedPattern) {
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        [pscustomobject]@{ ok = ([int]$response.StatusCode -eq 200 -and $response.Content -match $ExpectedPattern); http_status = [int]$response.StatusCode; error = $null }
    } catch {
        [pscustomobject]@{ ok = $false; http_status = $null; error = $_.Exception.Message }
    }
}

$listeners = [ordered]@{
    api = @(Get-ListenerPids $ApiPort)
    frontend_proxy = @(Get-ListenerPids $FrontendPort)
    speech = @(Get-ListenerPids $SpeechPort)
}
$health = [ordered]@{
    api = Test-Health "http://127.0.0.1:$ApiPort/api/v1/health/ready" '"status"\s*:\s*"ok"'
    frontend_proxy = Test-Health "http://127.0.0.1:$FrontendPort/api/v1/health/ready" '"status"\s*:\s*"ok"'
    speech = Test-Health "http://127.0.0.1:$SpeechPort/health" '"status"\s*:\s*"ok"'
}

$manifest = $null
$manifestError = $null
if (Test-Path -LiteralPath $StatePath) {
    try { $manifest = Get-Content -LiteralPath $StatePath -Raw -Encoding UTF8 | ConvertFrom-Json } catch { $manifestError = $_.Exception.Message }
} else {
    $manifestError = 'MANIFEST_MISSING'
}
$commitAttested = $false
if ($manifest) {
    $commitAttested = ([string]$manifest.repository_root).Equals($rootDir, [StringComparison]::OrdinalIgnoreCase) -and
        ([string]$manifest.commit -eq $ExpectedCommit) -and
        ([string]$manifest.nonce).Length -ge 32 -and
        [int]$manifest.ports.api -eq $ApiPort -and [int]$manifest.ports.frontend -eq $FrontendPort -and [int]$manifest.ports.speech -eq $SpeechPort
}
$testFixture = $false
if ($manifest -and $manifest.test_fixture -eq $true) {
    $tempFixturePrefix = Join-Path ([IO.Path]::GetTempPath()) 'yuzan-runtime-test-'
    $testFixture = [IO.Path]::GetFullPath($StatePath).StartsWith($tempFixturePrefix, [StringComparison]::OrdinalIgnoreCase) -and
        $ApiPort -ne 4000 -and $FrontendPort -ne 4175 -and $SpeechPort -ne 8100
    if (-not $testFixture) { $commitAttested = $false }
}

$services = [ordered]@{}
foreach ($name in @('api', 'frontend_proxy', 'speech', 'worker')) {
    $record = $null
    if ($manifest -and $manifest.services -and $manifest.services.PSObject.Properties[$name]) { $record = $manifest.services.PSObject.Properties[$name].Value }
    $expectedCommandHash = $null
    $expectedWrapperHash = $null
    if ($record -and $manifest) {
        $attestationArgs = @(
            "--yuzan-runtime-nonce=$([string]$manifest.nonce)",
            "--yuzan-runtime-root=$rootDir",
            "--yuzan-runtime-commit=$ExpectedCommit"
        )
        $executable = [IO.Path]::GetFullPath([string]$record.child_executable_path)
        $wrapperExecutable = [IO.Path]::GetFullPath([string]$record.wrapper_executable_path)
        $expectedExecutableName = if ($testFixture -or $name -eq 'speech') { 'python.exe' } else { 'node.exe' }
        if ([IO.Path]::GetFileName($executable).Equals($expectedExecutableName, [StringComparison]::OrdinalIgnoreCase) -and
            [IO.Path]::GetFileName($wrapperExecutable).Equals('python.exe', [StringComparison]::OrdinalIgnoreCase)) {
            if ($testFixture) {
                $expectedArgs = @((Join-Path $PSScriptRoot 'runtime-test-service.py'), '--role', $name)
                if ($name -ne 'worker') {
                    $expectedPort = if ($name -eq 'api') { $ApiPort } elseif ($name -eq 'frontend_proxy') { $FrontendPort } else { $SpeechPort }
                    $expectedArgs += @('--host', '127.0.0.1', '--port', [string]$expectedPort)
                }
                $expectedArgs += $attestationArgs
            } else {
                $expectedArgs = switch ($name) {
                    'api' { @((Join-Path $rootDir 'backend\api\dist\main.js')) + $attestationArgs }
                    'frontend_proxy' { @((Join-Path $rootDir 'frontend\server.mjs')) + $attestationArgs }
                    'speech' { @((Join-Path $PSScriptRoot 'managed-speech.py'), '--host', '127.0.0.1', '--port', [string]$SpeechPort) + $attestationArgs }
                    'worker' { @((Join-Path $rootDir 'backend\worker\dist\main.js')) + $attestationArgs }
                }
            }
            $expectedCommand = @($executable) + $expectedArgs
            $expectedCommandJson = ConvertTo-Json -InputObject $expectedCommand -Compress
            $expectedCommandHash = Get-TextSha256 $expectedCommandJson
            $commandBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($expectedCommandJson))
            $wrapperArgs = @(
                ([IO.Path]::GetFullPath([string]$record.wrapper_script)),
                '--role', $name,
                '--attestation-dir', (Split-Path -Parent ([string]$record.attestation_path)),
                '--nonce', ([string]$manifest.nonce),
                '--repository-root', $rootDir,
                '--commit', $ExpectedCommit,
                '--command-base64', $commandBase64
            )
            $expectedWrapperHash = Get-CommandArgvSha256 (@($wrapperExecutable) + $wrapperArgs)
        }
    }
    $ownership = if ($commitAttested) {
        Test-ManagedProcessRecord -Record $record -ManifestNonce ([string]$manifest.nonce) -RepositoryRoot $rootDir `
            -ExpectedCommit $ExpectedCommit -ExpectedWrapperArgvSha256 $expectedWrapperHash `
            -ExpectedCommandArgvSha256 $expectedCommandHash
    } else {
        [pscustomobject]@{ valid = $false; reason = 'COMMIT_OR_MANIFEST_UNATTESTED'; pid = $(if ($record) { [int]$record.pid } else { $null }) }
    }
    $port = $null
    $serviceHealth = [pscustomobject]@{ ok = $ownership.valid; http_status = $null; error = $null }
    $listenerOwned = $true
    if ($name -ne 'worker') {
        $port = if ($name -eq 'api') { $ApiPort } elseif ($name -eq 'frontend_proxy') { $FrontendPort } else { $SpeechPort }
        $serviceHealth = $health[$name]
        $listenerOwned = $ownership.valid -and @($listeners[$name]).Count -eq 1 -and [int]$listeners[$name][0] -eq [int]$ownership.pid
    }
    $services[$name] = [ordered]@{
        port = $port
        pid = $ownership.pid
        listener_pids = $(if ($name -ne 'worker') { @($listeners[$name]) } else { @() })
        ownership_valid = [bool]$ownership.valid
        ownership_reason = [string]$ownership.reason
        listener_owned = [bool]$listenerOwned
        healthy = [bool]$serviceHealth.ok
        http_status = $serviceHealth.http_status
        error = $serviceHealth.error
    }
}

$allReady = $commitAttested
foreach ($name in @('api', 'frontend_proxy', 'speech', 'worker')) {
    $service = $services[$name]
    $allReady = $allReady -and $service.ownership_valid -and $service.listener_owned -and $service.healthy
}
$anyListener = @($listeners.api + $listeners.frontend_proxy + $listeners.speech).Count -gt 0
$managedWorkerPresent = $services.worker.pid -and (Get-Process -Id ([int]$services.worker.pid) -ErrorAction SilentlyContinue)

[pscustomobject]@{
    schema_version = 2
    checked_at = [DateTime]::UtcNow.ToString('o')
    repository_root = $rootDir
    expected_commit = $ExpectedCommit
    manifest_commit = $(if ($manifest) { [string]$manifest.commit } else { $null })
    state_path = $StatePath
    fixed_ports = [ordered]@{ api = $ApiPort; frontend = $FrontendPort; speech = $SpeechPort }
    commit_attested = [bool]$commitAttested
    all_ready = [bool]$allReady
    any_service_detected = [bool]($anyListener -or $managedWorkerPresent)
    provenance = $(if ($allReady) { 'EXACT_COMMIT_ATTESTED' } else { 'UNATTESTED_OR_UNOWNED' })
    manifest_error = $manifestError
    services = $services
}
