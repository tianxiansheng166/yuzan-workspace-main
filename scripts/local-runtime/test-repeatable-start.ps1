[CmdletBinding()]
param(
    [ValidateSet('Syntax', 'Runtime')]
    [string]$Mode = 'Syntax',
    [string]$RepositoryRoot
)

$ErrorActionPreference = 'Stop'
$scripts = @(
    (Join-Path $PSScriptRoot 'start-main.ps1'),
    (Join-Path $PSScriptRoot 'start-core.ps1'),
    (Join-Path $PSScriptRoot 'get-runtime-status.ps1'),
    (Join-Path $PSScriptRoot 'runtime-common.ps1'),
    $PSCommandPath
)
foreach ($script in $scripts) {
    $tokens = $null; $errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile($script, [ref]$tokens, [ref]$errors)
    if ($errors.Count -gt 0) { throw "PowerShell parse failed for $script`: $($errors.Message -join '; ')" }
}
python -m py_compile (Join-Path $PSScriptRoot 'managed-process.py') (Join-Path $PSScriptRoot 'managed-speech.py') (Join-Path $PSScriptRoot 'runtime-test-service.py')
if ($LASTEXITCODE -ne 0) { throw 'Python runtime launcher syntax check failed.' }
if ($Mode -eq 'Syntax') {
    [pscustomobject]@{ mode = 'Syntax'; result = 'PASS'; powershell_scripts = $scripts.Count; python_scripts = 3 } | ConvertTo-Json
    return
}

if (-not $RepositoryRoot) { $RepositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path }
$rootDir = [System.IO.Path]::GetFullPath($RepositoryRoot)
$commit = ([string](git -C $rootDir rev-parse HEAD)).Trim()
$python = Get-Command python -ErrorAction Stop
$statusScript = Join-Path $PSScriptRoot 'get-runtime-status.ps1'
$startScript = Join-Path $PSScriptRoot 'start-core.ps1'
. (Join-Path $PSScriptRoot 'runtime-common.ps1')
Repair-ProcessPathEnvironment
$testDir = Join-Path ([System.IO.Path]::GetTempPath()) ("yuzan-runtime-test-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testDir -Force | Out-Null
$processes = [System.Collections.Generic.List[System.Diagnostics.Process]]::new()

function Get-FreePort {
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    try { $listener.Start(); return ([Net.IPEndPoint]$listener.LocalEndpoint).Port } finally { $listener.Stop() }
}

function Start-TestRole(
    [string]$Role,
    [AllowNull()][Nullable[int]]$Port,
    [string]$Nonce,
    [string[]]$ChildCommand,
    [string]$AttestationDirectory
) {
    if (-not $ChildCommand) {
        $args = @((Join-Path $PSScriptRoot 'runtime-test-service.py'), '--role', $Role)
        if ($Port) { $args += @('--host', '127.0.0.1', '--port', [string]$Port) }
        $args += @("--yuzan-runtime-nonce=$Nonce", "--yuzan-runtime-root=$rootDir", "--yuzan-runtime-commit=$commit")
        $ChildCommand = @($python.Source) + $args
    }
    $commandJson = $childCommand | ConvertTo-Json -Compress
    $commandBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($commandJson))
    $attestationDir = if ($AttestationDirectory) { $AttestationDirectory } else { Join-Path $testDir 'attestations' }
    $wrapperScript = Join-Path $PSScriptRoot 'managed-process.py'
    $wrapperArgs = @($wrapperScript, '--role', $Role, '--attestation-dir', $attestationDir, '--nonce', $Nonce,
        '--repository-root', $rootDir, '--commit', $commit, '--command-base64', $commandBase64)
    $process = Start-Process -FilePath $python.Source -ArgumentList $wrapperArgs -WorkingDirectory $rootDir -WindowStyle Hidden -PassThru
    $processes.Add($process)
    $record = New-ManagedProcessRecord -Name $Role -WrapperProcess $process `
        -AttestationPath (Join-Path $attestationDir "$Role.json") -LockPath (Join-Path $attestationDir "$Role.lock") `
        -WrapperScript $wrapperScript -CommandArgvSha256 (Get-TextSha256 $commandJson) -Port $Port
    $processes.Add((Get-Process -Id ([int]$record.child_pid) -ErrorAction Stop))
    [pscustomobject]@{ process = $process; record = $record }
}

function Get-Fingerprint($Status) {
    "api=$($Status.services.api.pid);frontend_proxy=$($Status.services.frontend_proxy.pid);speech=$($Status.services.speech.pid);worker=$($Status.services.worker.pid)"
}

try {
    $apiPort = Get-FreePort; $frontendPort = Get-FreePort; $speechPort = Get-FreePort
    $nonce = [Guid]::NewGuid().ToString('N')
    $api = Start-TestRole 'api' $apiPort $nonce
    $frontend = Start-TestRole 'frontend_proxy' $frontendPort $nonce
    $speech = Start-TestRole 'speech' $speechPort $nonce
    $worker = Start-TestRole 'worker' $null $nonce
    $manifestPath = Join-Path $testDir 'process-manifest.json'
    $manifest = [ordered]@{
        schema_version = 2; test_fixture = $true; nonce = $nonce; repository_root = $rootDir; commit = $commit; started_at = [DateTime]::UtcNow.ToString('o')
        ports = [ordered]@{ api = $apiPort; frontend = $frontendPort; speech = $speechPort }
        services = [ordered]@{ api = $api.record; frontend_proxy = $frontend.record; speech = $speech.record; worker = $worker.record }
    }
    Write-JsonAtomic $manifestPath $manifest

    $positive = $null
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        $positive = & $statusScript -RepositoryRoot $rootDir -ExpectedCommit $commit -StatePath $manifestPath -ApiPort $apiPort -FrontendPort $frontendPort -SpeechPort $speechPort
        if ($positive.all_ready) { break }
        Start-Sleep -Milliseconds 200
    }
    if (-not $positive.all_ready -or -not $positive.commit_attested -or $positive.provenance -ne 'EXACT_COMMIT_ATTESTED') {
        throw "Clean managed runtime did not attest: $($positive | ConvertTo-Json -Depth 10 -Compress)"
    }
    $firstStartJson = & $startScript -RepositoryRoot $rootDir -ExpectedCommit $commit -StatePath $manifestPath `
        -ApiPort $apiPort -FrontendPort $frontendPort -SpeechPort $speechPort -ReuseOnly
    $firstStart = ($firstStartJson -join [Environment]::NewLine) | ConvertFrom-Json
    $secondStartJson = & $startScript -RepositoryRoot $rootDir -ExpectedCommit $commit -StatePath $manifestPath `
        -ApiPort $apiPort -FrontendPort $frontendPort -SpeechPort $speechPort -ReuseOnly
    $secondStart = ($secondStartJson -join [Environment]::NewLine) | ConvertFrom-Json
    $positiveFingerprint = Get-Fingerprint $positive
    $firstFingerprint = Get-Fingerprint $firstStart
    $secondFingerprint = Get-Fingerprint $secondStart
    if (-not $firstStart.all_ready -or -not $secondStart.all_ready -or
        $positiveFingerprint -ne $firstFingerprint -or $firstFingerprint -ne $secondFingerprint) {
        throw "Managed PID fingerprint changed across two idempotent starts: probe=$positiveFingerprint first=$firstFingerprint second=$secondFingerprint"
    }

    $missingStatePath = Join-Path $testDir 'missing.json'
    $partial = & $statusScript -RepositoryRoot $rootDir -ExpectedCommit $commit -StatePath $missingStatePath -ApiPort $apiPort -FrontendPort $frontendPort -SpeechPort $speechPort
    if ($partial.all_ready -or -not $partial.any_service_detected) { throw 'Foreign/partial listeners were not rejected.' }
    $partialFingerprint = Get-Fingerprint $positive
    try {
        & $startScript -RepositoryRoot $rootDir -ExpectedCommit $commit -StatePath $missingStatePath `
            -ApiPort $apiPort -FrontendPort $frontendPort -SpeechPort $speechPort -ReuseOnly | Out-Null
        throw 'Foreign/partial occupancy unexpectedly passed the startup entry point.'
    } catch {
        if ($_.Exception.Message -notmatch 'Unowned, partial, unhealthy, or wrong-commit runtime detected') { throw }
    }
    $afterPartial = & $statusScript -RepositoryRoot $rootDir -ExpectedCommit $commit -StatePath $manifestPath -ApiPort $apiPort -FrontendPort $frontendPort -SpeechPort $speechPort
    if ((Get-Fingerprint $afterPartial) -ne $partialFingerprint -or
        $afterPartial.fixed_ports.api -ne $apiPort -or $afterPartial.fixed_ports.frontend -ne $frontendPort -or
        $afterPartial.fixed_ports.speech -ne $speechPort) {
        throw 'Foreign occupancy rejection killed a process or changed a port.'
    }

    $powershell = Get-Command powershell -ErrorAction Stop
    $spoofCommand = @(
        $powershell.Source, '-NoProfile', '-Command',
        "Start-Sleep -Seconds 60 # $rootDir backend\worker src/main.ts"
    )
    $spoof = Start-TestRole -Role 'worker' -Port $null -Nonce $nonce -ChildCommand $spoofCommand `
        -AttestationDirectory (Join-Path $testDir 'spoof-attestations')
    $spoofManifest = [ordered]@{
        schema_version = 2; test_fixture = $true; nonce = $nonce; repository_root = $rootDir; commit = $commit; started_at = [DateTime]::UtcNow.ToString('o')
        ports = $manifest.ports
        services = [ordered]@{ api = $api.record; frontend_proxy = $frontend.record; speech = $speech.record; worker = $spoof.record }
    }
    $spoofPath = Join-Path $testDir 'spoof-manifest.json'; Write-JsonAtomic $spoofPath $spoofManifest
    $spoofStatus = & $statusScript -RepositoryRoot $rootDir -ExpectedCommit $commit -StatePath $spoofPath -ApiPort $apiPort -FrontendPort $frontendPort -SpeechPort $speechPort
    if ($spoofStatus.all_ready -or $spoofStatus.services.worker.ownership_valid -or
        $spoofStatus.services.worker.ownership_reason -ne 'COMMAND_ARGV_MISMATCH') {
        throw "A command-line spoof was not rejected by the argv contract: $($spoofStatus.services.worker | ConvertTo-Json -Compress)"
    }

    $wrongCommit = ('f' * 40)
    $commitStatus = & $statusScript -RepositoryRoot $rootDir -ExpectedCommit $wrongCommit -StatePath $manifestPath -ApiPort $apiPort -FrontendPort $frontendPort -SpeechPort $speechPort
    if ($commitStatus.all_ready -or $commitStatus.commit_attested -or $commitStatus.provenance -eq 'EXACT_COMMIT_ATTESTED') {
        throw 'Wrong candidate commit was accepted.'
    }

    $result = [ordered]@{
        schema_version = 2
        run_at = [DateTime]::UtcNow.ToString('o')
        result = 'PASS'
        candidate_commit = $commit
        positive_clean_start = 'PASS_EXACT_COMMIT_ATTESTED'
        two_idempotent_starts = 'PASS_IDENTICAL_PIDS_AND_COMMIT'
        foreign_partial_occupancy = 'PASS_FAILED_CLOSED_NO_KILL_NO_PORT_CHANGE'
        command_line_spoof = 'PASS_POWERSHELL_SLEEP_REJECTED_COMMAND_ARGV_MISMATCH'
        wrong_candidate_commit = 'PASS_REJECTED'
        pid_fingerprint = Get-Fingerprint $positive
        ports = $positive.fixed_ports
    }
    $evidenceDir = Join-Path $rootDir 'runtime-local\local-runtime'
    New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null
    Write-JsonAtomic (Join-Path $evidenceDir 'repeat-start-result.json') $result
    $result | ConvertTo-Json -Depth 8
} finally {
    foreach ($process in $processes) {
        if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
    }
    Remove-Item -LiteralPath $testDir -Recurse -Force -ErrorAction SilentlyContinue
}
