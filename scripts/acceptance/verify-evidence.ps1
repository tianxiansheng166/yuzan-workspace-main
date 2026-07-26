[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ManifestPath,

    [string]$ExpectedRuntimeCommit,

    [string]$ExpectedJourneyId
)

$ErrorActionPreference = 'Stop'

function Add-Failure {
    param([string]$Message)
    $script:Failures.Add($Message) | Out-Null
}

function Get-RequiredProperty {
    param(
        [object]$Object,
        [string]$Name
    )
    if ($null -eq $Object -or -not ($Object.PSObject.Properties.Name -contains $Name)) {
        Add-Failure "Missing required property: $Name"
        return $null
    }
    return $Object.$Name
}

$resolvedManifest = (Resolve-Path -LiteralPath $ManifestPath).Path
$manifestDir = Split-Path -Parent $resolvedManifest
$raw = Get-Content -LiteralPath $resolvedManifest -Raw -Encoding UTF8
$manifest = $raw | ConvertFrom-Json
$script:Failures = [System.Collections.Generic.List[string]]::new()

$required = @(
    'schema_version', 'task_id', 'journey_id', 'run_id', 'attempt', 'verifier_id',
    'implementer_id', 'candidate_commit', 'runtime_commit', 'runtime_clean', 'started_at',
    'finished_at', 'levels', 'dynamic_ids', 'browser', 'cross_checks', 'forbidden_usage',
    'artifacts', 'verdict'
)
foreach ($name in $required) { [void](Get-RequiredProperty -Object $manifest -Name $name) }

if ($manifest.schema_version -ne 1) { Add-Failure 'schema_version must be 1' }
if ([string]$manifest.verdict -ne 'VERIFIED') { Add-Failure 'verdict must be VERIFIED' }
if ($manifest.runtime_clean -ne $true) { Add-Failure 'runtime_clean must be true' }
if ([string]$manifest.verifier_id -eq [string]$manifest.implementer_id) {
    Add-Failure 'verifier_id must differ from implementer_id'
}
if ([string]$manifest.run_id -notmatch '^E2E-[0-9]{8}-[A-Za-z0-9-]{6,}$') {
    Add-Failure 'run_id must be a new dynamic E2E identifier'
}
foreach ($property in @('candidate_commit', 'runtime_commit')) {
    if ([string]$manifest.$property -notmatch '^[0-9a-f]{40}$') {
        Add-Failure "$property must be a full lowercase Git commit"
    }
}
if ($ExpectedRuntimeCommit -and [string]$manifest.runtime_commit -ne $ExpectedRuntimeCommit) {
    Add-Failure "runtime_commit does not match expected commit $ExpectedRuntimeCommit"
}
if ($ExpectedJourneyId -and [string]$manifest.journey_id -ne $ExpectedJourneyId) {
    Add-Failure "journey_id does not match $ExpectedJourneyId"
}

foreach ($level in @('L3_BROWSER', 'L4_PERSISTENCE', 'L5_FRESH_CONTEXT_NEGATIVE')) {
    if (-not ($manifest.levels.PSObject.Properties.Name -contains $level) -or
        [string]$manifest.levels.$level -ne 'PASS') {
        Add-Failure "Evidence level is not PASS: $level"
    }
}

$dynamicValues = @()
foreach ($name in @('assignment_id', 'attempt_or_submission_id', 'recording_id')) {
    if (-not ($manifest.dynamic_ids.PSObject.Properties.Name -contains $name) -or
        [string]::IsNullOrWhiteSpace([string]$manifest.dynamic_ids.$name)) {
        Add-Failure "Missing dynamic id: $name"
    } else {
        $dynamicValues += [string]$manifest.dynamic_ids.$name
    }
}
foreach ($value in $dynamicValues) {
    if ($value -match '^(submission-1|assignment-1|attempt-1)$' -or $value -match '(?i)demo') {
        Add-Failure "Fixed or demo business id is forbidden: $value"
    }
}

$browser = $manifest.browser
if ([int]$browser.teacher_contexts -lt 2) { Add-Failure 'At least two fresh teacher contexts are required' }
if ([int]$browser.student_contexts -lt 1) { Add-Failure 'At least one fresh student context is required' }
if ($browser.primary_writes_from_ui -ne $true) { Add-Failure 'Primary business writes must originate from UI' }
if ($browser.route_interception -ne $false) { Add-Failure 'Playwright route interception is forbidden' }
foreach ($counter in @('console_errors', 'page_errors', 'unexpected_request_failures')) {
    if ([int]$browser.$counter -ne 0) { Add-Failure "$counter must be zero" }
}
if (@($browser.viewports) -notcontains '390x844') { Add-Failure '390x844 browser evidence is required' }

foreach ($check in @('api', 'database', 'object_storage', 'tenant_negative')) {
    if (-not ($manifest.cross_checks.PSObject.Properties.Name -contains $check) -or
        [string]$manifest.cross_checks.$check -ne 'PASS') {
        Add-Failure "Cross-check is not PASS: $check"
    }
}

if (@($manifest.forbidden_usage).Count -ne 0) { Add-Failure 'forbidden_usage must be empty' }
if (@($manifest.artifacts).Count -eq 0) { Add-Failure 'At least one hashed artifact is required' }
foreach ($artifact in @($manifest.artifacts)) {
    $relativePath = [string]$artifact.path
    if ([string]::IsNullOrWhiteSpace($relativePath) -or [System.IO.Path]::IsPathRooted($relativePath)) {
        Add-Failure "Artifact path must be non-empty and relative: $relativePath"
        continue
    }
    $artifactPath = [System.IO.Path]::GetFullPath((Join-Path $manifestDir $relativePath))
    $relativeCheck = [System.IO.Path]::GetRelativePath($manifestDir, $artifactPath)
    if ($relativeCheck -eq '..' -or $relativeCheck.StartsWith('..\') -or $relativeCheck.StartsWith('../') -or [System.IO.Path]::IsPathRooted($relativeCheck)) {
        Add-Failure "Artifact escapes evidence directory: $relativePath"
        continue
    }
    if (-not (Test-Path -LiteralPath $artifactPath -PathType Leaf)) {
        Add-Failure "Artifact does not exist: $relativePath"
        continue
    }
    $actualHash = (Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne [string]$artifact.sha256) {
        Add-Failure "Artifact hash mismatch: $relativePath"
    }
}

if ($raw -match '(?i)(?:sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)') {
    Add-Failure 'Manifest contains a secret-like token'
}

if ($script:Failures.Count -gt 0) {
    foreach ($failure in $script:Failures) { Write-Host "[FAIL] $failure" -ForegroundColor Red }
    throw "Evidence rejected with $($script:Failures.Count) issue(s)."
}

Write-Host "[PASS] task=$($manifest.task_id) journey=$($manifest.journey_id) run=$($manifest.run_id) runtime=$($manifest.runtime_commit)" -ForegroundColor Green
