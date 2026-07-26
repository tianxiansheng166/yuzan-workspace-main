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
    $PSCommandPath
)

foreach ($script in $scripts) {
    $tokens = $null
    $errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile($script, [ref]$tokens, [ref]$errors)
    if ($errors.Count -gt 0) {
        throw "PowerShell parse failed for $script`: $($errors.Message -join '; ')"
    }
}

if ($Mode -eq 'Syntax') {
    [pscustomobject]@{ mode = 'Syntax'; result = 'PASS'; scripts = $scripts.Count } | ConvertTo-Json
    return
}

if (-not $RepositoryRoot) {
    throw '-RepositoryRoot is required for Runtime mode.'
}
$rootDir = [System.IO.Path]::GetFullPath($RepositoryRoot)
$statusScript = Join-Path $PSScriptRoot 'get-runtime-status.ps1'
$startScript = Join-Path $PSScriptRoot 'start-core.ps1'

function Get-PidFingerprint($Status) {
    $parts = @()
    foreach ($name in @('api', 'frontend_proxy', 'speech', 'worker')) {
        $pids = @($Status.services.$name.pids) | Sort-Object
        $parts += "$name=$($pids -join ',')"
    }
    return ($parts -join ';')
}

$before = & $statusScript -RepositoryRoot $rootDir
if (-not $before.all_ready) {
    throw "Runtime precondition is not ready; test refuses to mutate a partial runtime: $($before | ConvertTo-Json -Depth 8 -Compress)"
}
$fingerprintBefore = Get-PidFingerprint $before

& $startScript -RepositoryRoot $rootDir -SkipDocker -SkipGenerate | Out-Null
$afterFirst = & $statusScript -RepositoryRoot $rootDir
$fingerprintFirst = Get-PidFingerprint $afterFirst
& $startScript -RepositoryRoot $rootDir -SkipDocker -SkipGenerate | Out-Null
$afterSecond = & $statusScript -RepositoryRoot $rootDir
$fingerprintSecond = Get-PidFingerprint $afterSecond

if (-not $afterFirst.all_ready -or -not $afterSecond.all_ready) {
    throw 'Runtime stopped being healthy during repeat-start verification.'
}
if ($fingerprintBefore -ne $fingerprintFirst -or $fingerprintFirst -ne $fingerprintSecond) {
    throw "Process set changed across repeated starts: before=$fingerprintBefore first=$fingerprintFirst second=$fingerprintSecond"
}
if ($afterSecond.fixed_ports.api -ne 4000 -or $afterSecond.fixed_ports.frontend -ne 4175 -or $afterSecond.fixed_ports.speech -ne 8100) {
    throw 'A runtime port drifted from the fixed contract.'
}
$evidenceDir = Join-Path $rootDir 'runtime-local\local-runtime'
New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null
$evidencePath = Join-Path $evidenceDir 'repeat-start-result.json'
$result = [ordered]@{
    schema_version = 1
    run_at = [DateTime]::UtcNow.ToString('o')
    result = 'PASS'
    repository_commit = $afterSecond.repository_commit
    provenance = $afterSecond.provenance
    note = 'Health and PID stability are proven; running process build provenance is not commit-attested.'
    fixed_ports = $afterSecond.fixed_ports
    pid_fingerprint = $fingerprintSecond
    duplicate_worker_warning = $afterSecond.duplicate_worker_warning
    services = $afterSecond.services
}
$json = $result | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($evidencePath, $json, [System.Text.UTF8Encoding]::new($false))
$json
