[CmdletBinding()]
param(
    [ValidateSet('all', 'schema', 'simulation', 'context', 'inventory', 'docs')]
    [string]$Mode = 'all'
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$control = Join-Path $repoRoot 'scripts\repo\mvp-control.ps1'
$failures = [System.Collections.Generic.List[string]]::new()

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { $script:failures.Add($Message) | Out-Null }
}

function Invoke-Control {
    param([string]$RuntimeRoot, [string[]]$Arguments)
    $pwsh = Join-Path $PSHOME 'pwsh.exe'
    $output = & $pwsh -NoLogo -NoProfile -File $control @Arguments -RuntimeRoot $RuntimeRoot 2>&1
    if ($LASTEXITCODE -ne 0) { throw "mvp-control failed: $($Arguments -join ' ')`n$($output -join "`n")" }
    return @($output)
}

function Read-State {
    param([string]$RuntimeRoot)
    return Get-Content -LiteralPath (Join-Path $RuntimeRoot 'state.json') -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Find-StateTask {
    param([object]$State, [string]$TaskId)
    return @($State.tasks | Where-Object { [string]$_.id -eq $TaskId }) | Select-Object -First 1
}

function Write-TestJson {
    param([string]$Path, [object]$Value)
    $Value | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Test-Schema {
    $jsonFiles = @(
        'project-ops/control-plane/goal.json',
        'project-ops/control-plane/scheduler-policy.json',
        'project-ops/control-plane/bootstrap-work-items.json',
        'project-ops/control-plane/document-registry.json',
        'project-ops/control-plane/schemas/feature-chain.schema.json',
        'project-ops/acceptance/schemas/evidence-manifest.schema.json',
        'project-ops/acceptance/journeys/P0-TEACHER-STUDENT-ASSIGNMENT.journey.json'
    )
    foreach ($relative in $jsonFiles) {
        $path = Join-Path $repoRoot $relative
        Assert-True (Test-Path -LiteralPath $path -PathType Leaf) "missing JSON: $relative"
        if (Test-Path -LiteralPath $path -PathType Leaf) {
            try { $null = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json }
            catch { $failures.Add("invalid JSON: $relative :: $($_.Exception.Message)") | Out-Null }
        }
    }

    $config = Get-Content -LiteralPath (Join-Path $repoRoot '.codex\config.toml') -Raw -Encoding UTF8
    Assert-True ($config -match '(?m)^goals\s*=\s*true\s*$') '.codex/config.toml must enable goals'
    Assert-True ($config -match '(?m)^multi_agent\s*=\s*true\s*$') '.codex/config.toml must enable multi_agent'
    Assert-True ($config -notmatch '(?m)^max_(agents|threads|workers)\s*=') 'Codex config must not impose a fixed worker count'

    $goal = Get-Content -LiteralPath (Join-Path $repoRoot 'project-ops\control-plane\goal.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $bootstrap = Get-Content -LiteralPath (Join-Path $repoRoot 'project-ops\control-plane\bootstrap-work-items.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-True ([string]$goal.goal_id -eq [string]$bootstrap.goal_id) 'goal_id mismatch between goal and bootstrap DAG'
    Assert-True ([int]$goal.revision -eq [int]$bootstrap.goal_revision) 'goal revision mismatch between goal and bootstrap DAG'
    Assert-True (@($bootstrap.items.id | Sort-Object -Unique).Count -eq @($bootstrap.items).Count) 'bootstrap task IDs must be unique'
    $featureChainFiles = @(Get-ChildItem -LiteralPath (Join-Path $repoRoot 'project-ops\control-plane\feature-chains') -Filter '*.json' -File)
    Assert-True ($featureChainFiles.Count -gt 0) 'at least one FeatureChain contract is required'
    foreach ($file in $featureChainFiles) {
        $chain = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
        foreach ($field in @('feature_chain_id', 'goal_id', 'goal_revision', 'acceptance_id', 'actor', 'page', 'control', 'request', 'domain', 'persistence', 'downstream_observation', 'recovery', 'negative_path', 'status', 'required_evidence')) {
            Assert-True ($chain.PSObject.Properties.Name -contains $field) "$($file.Name) missing FeatureChain field: $field"
        }
        Assert-True (@($chain.required_evidence) -contains 'L3_BROWSER') "$($file.Name) must require L3_BROWSER"
    }
    foreach ($item in @($bootstrap.items)) {
        Assert-True (@($item.contract_paths).Count -gt 0) "$($item.id) must reference at least one acceptance/FeatureChain contract"
        foreach ($relative in @($item.contract_paths)) {
            Assert-True (Test-Path -LiteralPath (Join-Path $repoRoot ([string]$relative)) -PathType Leaf) "$($item.id) contract path missing: $relative"
        }
    }
}

function Test-Simulation {
    $runtime = Join-Path ([System.IO.Path]::GetTempPath()) ("yuzan-control-test-" + [Guid]::NewGuid().ToString('N'))
    Invoke-Control $runtime @('-Action', 'init') | Out-Null
    Invoke-Control $runtime @('-Action', 'register', '-AgentId', 'builder-auth', '-Capabilities', 'frontend,api,auth') | Out-Null
    Invoke-Control $runtime @('-Action', 'register', '-AgentId', 'builder-routing', '-Capabilities', 'frontend,routing') | Out-Null
    Invoke-Control $runtime @('-Action', 'register', '-AgentId', 'builder-runtime', '-Capabilities', 'windows,runtime,powershell') | Out-Null
    Invoke-Control $runtime @('-Action', 'register', '-AgentId', 'verifier-one', '-Capabilities', 'browser,review') | Out-Null
    Invoke-Control $runtime @('-Action', 'register', '-AgentId', 'controller-one', '-Capabilities', 'controller,integration') | Out-Null
    Invoke-Control $runtime @('-Action', 'tick') | Out-Null

    $state = Read-State $runtime
    $active = @($state.tasks | Where-Object { $null -ne $_.lease })
    Assert-True ($active.Count -eq 3) 'elastic tick should dispatch all three safe runnable implementation tasks'
    Assert-True (@($active.lease.worker_id | Sort-Object -Unique).Count -eq 3) 'each active task must have a distinct worker'
    Assert-True (@($active | Where-Object { [string]$_.id -eq 'P0-MOBILE-VISUAL-BLOCKERS' }).Count -eq 0) 'dependent visual task must not run before auth acceptance'

    $taskId = 'P0-SEC-AUTH-DEMO-FALLBACK-REMOVAL'
    Invoke-Control $runtime @('-Action', 'context', '-AgentId', 'builder-auth') | Out-Null
    Invoke-Control $runtime @('-Action', 'tick') | Out-Null
    $state = Read-State $runtime
    $task = Find-StateTask $state $taskId
    $firstLease = [string]$task.lease.lease_id
    $firstEpoch = [int]$task.lease.fencing_epoch
    $payload = Join-Path $runtime 'candidate.json'
    Write-TestJson $payload ([pscustomobject]@{ candidate_commit = ('a' * 40) })
    Invoke-Control $runtime @('-Action', 'emit', '-AgentId', 'builder-auth', '-TaskId', $taskId, '-EventType', 'COMPLETE_CANDIDATE', '-PayloadFile', $payload) | Out-Null
    Invoke-Control $runtime @('-Action', 'tick') | Out-Null

    $state = Read-State $runtime
    $task = Find-StateTask $state $taskId
    Assert-True ([string]$task.state -eq 'VERIFYING') 'candidate must enter independent VERIFYING state'
    Assert-True ([string]$task.lease.worker_id -eq 'verifier-one') 'candidate must be assigned to independent verifier'
    Assert-True ([string]$task.lease.worker_id -ne [string]$task.implementer_id) 'implementer must not verify own candidate'
    $reviewLease = [string]$task.lease.lease_id
    $reviewEpoch = [int]$task.lease.fencing_epoch
    Invoke-Control $runtime @('-Action', 'context', '-AgentId', 'verifier-one') | Out-Null
    Invoke-Control $runtime @('-Action', 'tick') | Out-Null

    $rejection = Join-Path $runtime 'rejection.json'
    Write-TestJson $rejection ([pscustomobject]@{
        verdict = 'REJECTED'
        failed_acceptance_id = 'TRUTHFUL_AUTH_AND_RUNTIME'
        journey_step_id = 'teacher_login'
        failed_step = 'student_login'
        expected = 'fresh browser session authenticates through real UI'
        observed = 'demo fallback token used'
        reproduction = 'run login journey with API unavailable'
        failure_class = 'FAKE_SUCCESS'
        required_repair_outcome = 'remove fallback and rerun the same journey'
    })
    Invoke-Control $runtime @('-Action', 'emit', '-AgentId', 'verifier-one', '-TaskId', $taskId, '-EventType', 'REVIEW_RESULT', '-PayloadFile', $rejection) | Out-Null
    Invoke-Control $runtime @('-Action', 'tick') | Out-Null
    $state = Read-State $runtime
    $task = Find-StateTask $state $taskId
    Assert-True ([string]$task.state -eq 'IMPLEMENTING') 'rejected task should be automatically dispatched for rework'
    Assert-True ([int]$task.review_round -eq 1) 'rejection should increment review round'
    Assert-True ([string]$task.latest_failure.failed_step -eq 'student_login') 'latest verifier failure must survive into next work order'
    $secondLease = [string]$task.lease.lease_id
    $secondEpoch = [int]$task.lease.fencing_epoch
    Assert-True ($secondEpoch -gt $firstEpoch) 'rework lease must use a newer fencing epoch'
    Invoke-Control $runtime @('-Action', 'context', '-AgentId', 'builder-auth') | Out-Null
    Invoke-Control $runtime @('-Action', 'tick') | Out-Null

    $stale = Join-Path $runtime 'stale.json'
    Write-TestJson $stale ([pscustomobject]@{ candidate_commit = ('b' * 40) })
    Invoke-Control $runtime @('-Action', 'emit', '-AgentId', 'builder-auth', '-TaskId', $taskId, '-LeaseId', $firstLease, '-FencingEpoch', $firstEpoch, '-EventType', 'COMPLETE_CANDIDATE', '-PayloadFile', $stale) | Out-Null
    Invoke-Control $runtime @('-Action', 'tick') | Out-Null
    Assert-True (@(Get-ChildItem -LiteralPath (Join-Path $runtime 'events\rejected') -Filter '*.json' -File).Count -ge 1) 'stale fenced event must be rejected'

    $secondCandidate = Join-Path $runtime 'candidate-2.json'
    Write-TestJson $secondCandidate ([pscustomobject]@{ candidate_commit = ('c' * 40) })
    Invoke-Control $runtime @('-Action', 'emit', '-AgentId', 'builder-auth', '-TaskId', $taskId, '-LeaseId', $secondLease, '-FencingEpoch', $secondEpoch, '-EventType', 'COMPLETE_CANDIDATE', '-PayloadFile', $secondCandidate) | Out-Null
    Invoke-Control $runtime @('-Action', 'tick') | Out-Null
    $state = Read-State $runtime
    $task = Find-StateTask $state $taskId
    $verifiedLease = [string]$task.lease.lease_id
    $verifiedEpoch = [int]$task.lease.fencing_epoch
    Invoke-Control $runtime @('-Action', 'context', '-AgentId', 'verifier-one') | Out-Null
    Invoke-Control $runtime @('-Action', 'tick') | Out-Null

    $verified = Join-Path $runtime 'verified.json'
    Write-TestJson $verified ([pscustomobject]@{ verdict = 'VERIFIED'; evidence_manifest = 'runtime-local/control-plane/evidence/test/manifest.json' })
    Invoke-Control $runtime @('-Action', 'emit', '-AgentId', 'verifier-one', '-TaskId', $taskId, '-LeaseId', $verifiedLease, '-FencingEpoch', $verifiedEpoch, '-EventType', 'REVIEW_RESULT', '-PayloadFile', $verified) | Out-Null
    Invoke-Control $runtime @('-Action', 'tick') | Out-Null
    $state = Read-State $runtime
    $task = Find-StateTask $state $taskId
    Assert-True ([string]$task.state -eq 'WAITING_INTEGRATION') 'verified candidate must wait for integration; verification alone is not acceptance'

    $integrated = Join-Path $runtime 'integrated.json'
    Write-TestJson $integrated ([pscustomobject]@{ verdict = 'INTEGRATED_VERIFIED'; integration_commit = ('d' * 40) })
    Invoke-Control $runtime @('-Action', 'emit', '-AgentId', 'controller-one', '-TaskId', $taskId, '-EventType', 'INTEGRATION_RESULT', '-PayloadFile', $integrated) | Out-Null
    Invoke-Control $runtime @('-Action', 'tick') | Out-Null
    $state = Read-State $runtime
    $task = Find-StateTask $state $taskId
    Assert-True ([string]$task.state -eq 'ACCEPTED') 'only integrated verified result may accept the task'
    Assert-True ([string]$state.goal_status -eq 'ACTIVE') 'one accepted task must not complete the whole MVP Goal'
}

function Test-ContextRecovery {
    $runtime = Join-Path ([System.IO.Path]::GetTempPath()) ("yuzan-context-test-" + [Guid]::NewGuid().ToString('N'))
    Invoke-Control $runtime @('-Action', 'init') | Out-Null
    Invoke-Control $runtime @('-Action', 'claim', '-AgentId', 'context-worker', '-Capabilities', 'frontend,api,auth') | Out-Null
    $context = (Invoke-Control $runtime @('-Action', 'context', '-AgentId', 'context-worker')) -join "`n"
    Assert-True ($context -match 'goal_revision:\s*1') 'recovery context must contain Goal revision'
    Assert-True ($context -match 'goal_digest:\s*[0-9a-f]{64}') 'recovery context must contain Goal digest'
    Assert-True ($context -match 'lease_id') 'recovery context must contain active lease'
    Assert-True ($context -match 'next_action') 'recovery context must contain exactly actionable continuation data'
    Assert-True ($context -match 'stable_prompt') 'recovery context must point to stable role prompt instead of embedding all history'
}

function Test-Inventory {
    $python = Get-Command python -ErrorAction Stop
    $outDir = Join-Path ([System.IO.Path]::GetTempPath()) ("yuzan-inventory-test-" + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    & $python.Source (Join-Path $repoRoot 'scripts\audit\scan_frontend_controls.py') --repo $repoRoot --json (Join-Path $outDir 'controls.json') --markdown (Join-Path $outDir 'controls.md')
    if ($LASTEXITCODE -ne 0) { throw 'frontend inventory scanner failed' }
    $inventory = Get-Content -LiteralPath (Join-Path $outDir 'controls.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-True ([int]$inventory.totals.pages -gt 0) 'inventory must discover frontend pages'
    Assert-True ([int]$inventory.totals.controls -gt 0) 'inventory must discover frontend controls'
    $controls = @($inventory.pages | ForEach-Object { @($_.controls) })
    Assert-True (@($controls | Where-Object { $_.static_status }).Count -eq [int]$inventory.totals.controls) 'every discovered control must have an explicit static status'
    Assert-True (@($inventory.pages | Where-Object { [string]$_.static_limit -match '不证明' }).Count -eq [int]$inventory.totals.pages) 'every page must state the static scan proof limit'
}

function Test-Docs {
    $mustRead = @(
        'project-ops/control-plane/README.md',
        'project-ops/control-plane/FEATURE-CHAIN-CONTRACT.md',
        'project-ops/control-plane/prompts/controller-heartbeat.md',
        'project-ops/control-plane/prompts/worker-ticket.md',
        'project-ops/control-plane/prompts/verifier-ticket.md',
        'project-ops/acceptance/P0-GOLDEN-LOOP.md'
    )
    foreach ($relative in $mustRead) {
        $path = Join-Path $repoRoot $relative
        Assert-True (Test-Path -LiteralPath $path -PathType Leaf) "missing control document: $relative"
        if (Test-Path -LiteralPath $path -PathType Leaf) {
            $text = Get-Content -LiteralPath $path -Raw -Encoding UTF8
            Assert-True ($text.Length -lt 24000) "control document is too large for routine context: $relative"
        }
    }
    $trackedText = ($mustRead | ForEach-Object { Get-Content -LiteralPath (Join-Path $repoRoot $_) -Raw -Encoding UTF8 }) -join "`n"
    Assert-True ($trackedText -notmatch 'sk-[A-Za-z0-9_-]{16,}') 'control documents must not contain API keys'

    $evidenceDir = Join-Path ([System.IO.Path]::GetTempPath()) ("yuzan-evidence-test-" + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null
    $artifactPath = Join-Path $evidenceDir 'browser-result.json'
    Set-Content -LiteralPath $artifactPath -Value '{"result":"PASS"}' -Encoding UTF8
    $artifactHash = (Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $manifestPath = Join-Path $evidenceDir 'manifest.json'
    $manifest = [pscustomobject]@{
        schema_version = 1; task_id = 'TEST-EVIDENCE'; journey_id = 'P0-GOLDEN-LOOP'; run_id = 'E2E-20260726-ABCDEF'; attempt = 1
        verifier_id = 'verifier-test'; implementer_id = 'builder-test'; candidate_commit = ('a' * 40); runtime_commit = ('b' * 40); runtime_clean = $true
        started_at = '2026-07-26T00:00:00Z'; finished_at = '2026-07-26T00:01:00Z'
        levels = [pscustomobject]@{ L3_BROWSER = 'PASS'; L4_PERSISTENCE = 'PASS'; L5_FRESH_CONTEXT_NEGATIVE = 'PASS' }
        dynamic_ids = [pscustomobject]@{ assignment_id = 'assignment-dynamic-123'; attempt_or_submission_id = 'submission-dynamic-456'; recording_id = 'recording-dynamic-789' }
        browser = [pscustomobject]@{ teacher_contexts = 2; student_contexts = 1; primary_writes_from_ui = $true; route_interception = $false; console_errors = 0; page_errors = 0; unexpected_request_failures = 0; viewports = @('390x844') }
        cross_checks = [pscustomobject]@{ api = 'PASS'; database = 'PASS'; object_storage = 'PASS'; tenant_negative = 'PASS' }
        forbidden_usage = @(); artifacts = @([pscustomobject]@{ path = 'browser-result.json'; sha256 = $artifactHash }); verdict = 'VERIFIED'
    }
    Write-TestJson $manifestPath $manifest
    & (Join-Path $repoRoot 'scripts\acceptance\verify-evidence.ps1') -ManifestPath $manifestPath -ExpectedRuntimeCommit ('b' * 40) -ExpectedJourneyId 'P0-GOLDEN-LOOP' | Out-Null
    $manifest.dynamic_ids.attempt_or_submission_id = 'submission-1'
    Write-TestJson $manifestPath $manifest
    $rejected = $false
    try { & (Join-Path $repoRoot 'scripts\acceptance\verify-evidence.ps1') -ManifestPath $manifestPath 6>$null | Out-Null }
    catch { $rejected = $true }
    Assert-True $rejected 'fixed business ID must be rejected by evidence verifier'
}

$selected = if ($Mode -eq 'all') { @('schema', 'simulation', 'context', 'inventory', 'docs') } else { @($Mode) }
foreach ($test in $selected) {
    switch ($test) {
        'schema' { Test-Schema }
        'simulation' { Test-Simulation }
        'context' { Test-ContextRecovery }
        'inventory' { Test-Inventory }
        'docs' { Test-Docs }
    }
    if ($failures.Count -eq 0) { Write-Host "[PASS] $test" }
}

if ($failures.Count -gt 0) {
    foreach ($failure in $failures) { Write-Error "[FAIL] $failure" -ErrorAction Continue }
    exit 1
}

Write-Host '[PASS] all requested MVP control-plane tests passed'
