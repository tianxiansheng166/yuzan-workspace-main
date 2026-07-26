[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('init', 'register', 'tick', 'claim', 'heartbeat', 'emit', 'context', 'status')]
    [string]$Action,

    [string]$AgentId,
    [string[]]$Capabilities = @(),
    [string]$TaskId,
    [string]$EventType,
    [string]$PayloadFile,
    [string]$RuntimeRoot,
    [string]$LeaseId,
    [int]$FencingEpoch = 0,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$goalPath = Join-Path $repoRoot 'project-ops\control-plane\goal.json'
$policyPath = Join-Path $repoRoot 'project-ops\control-plane\scheduler-policy.json'
$bootstrapPath = Join-Path $repoRoot 'project-ops\control-plane\bootstrap-work-items.json'

function Get-UtcNowText { return [DateTime]::UtcNow.ToString('o') }

function Get-ControlRoot {
    if (-not [string]::IsNullOrWhiteSpace($RuntimeRoot)) {
        return [System.IO.Path]::GetFullPath($RuntimeRoot)
    }
    $targetPath = Join-Path $repoRoot 'project-ops\runtime-target.json'
    $canonicalRoot = $repoRoot
    if (Test-Path -LiteralPath $targetPath) {
        $target = Get-Content -LiteralPath $targetPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($target.PSObject.Properties.Name -contains 'canonical_root') {
            $canonicalRoot = [System.IO.Path]::GetFullPath([string]$target.canonical_root)
        }
    }
    return Join-Path $canonicalRoot 'runtime-local\control-plane'
}

$controlRoot = Get-ControlRoot
$statePath = Join-Path $controlRoot 'state.json'
$actionsPath = Join-Path $controlRoot 'actions.json'
$incomingDir = Join-Path $controlRoot 'events\incoming'
$processedDir = Join-Path $controlRoot 'events\processed'
$rejectedDir = Join-Path $controlRoot 'events\rejected'
$workOrdersDir = Join-Path $controlRoot 'work-orders'

function Ensure-Directories {
    foreach ($path in @($controlRoot, $incomingDir, $processedDir, $rejectedDir, $workOrdersDir, (Join-Path $controlRoot 'evidence'))) {
        New-Item -ItemType Directory -Force -Path $path | Out-Null
    }
}

function Write-JsonAtomic {
    param([string]$Path, [object]$Value)
    $parent = Split-Path -Parent $Path
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    $temp = Join-Path $parent (([System.IO.Path]::GetFileName($Path)) + '.' + [Guid]::NewGuid().ToString('N') + '.tmp')
    $json = $Value | ConvertTo-Json -Depth 40
    [System.IO.File]::WriteAllText($temp, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temp -Destination $Path -Force
}

function Read-JsonFile {
    param([string]$Path)
    # Preserve ISO-8601 timestamps as strings. PowerShell's default DateTime
    # conversion can turn a trailing-Z value into local time and then serialize
    # it without an offset, making a fresh lease look eight hours old.
    return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json -DateKind String
}

function Get-PathDigest {
    param([string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Invoke-WithControlLock {
    param([scriptblock]$ScriptBlock)
    Ensure-Directories
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($controlRoot.ToLowerInvariant())
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { $hash = ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').Substring(0, 24) }
    finally { $sha.Dispose() }
    $mutex = [System.Threading.Mutex]::new($false, "Local\YuzanMvpControl_$hash")
    $acquired = $false
    try {
        $acquired = $mutex.WaitOne([TimeSpan]::FromSeconds(15))
        if (-not $acquired) { throw "Control lock timeout: $controlRoot" }
        & $ScriptBlock
    } finally {
        if ($acquired) { $mutex.ReleaseMutex() }
        $mutex.Dispose()
    }
}

function Require-State {
    if (-not (Test-Path -LiteralPath $statePath -PathType Leaf)) {
        throw "Control plane is not initialized. Run: .\scripts\repo\mvp-control.ps1 -Action init"
    }
    return Read-JsonFile $statePath
}

function Find-Worker {
    param([object]$State, [string]$Id)
    return @($State.workers | Where-Object { [string]$_.worker_id -eq $Id }) | Select-Object -First 1
}

function Find-Task {
    param([object]$State, [string]$Id)
    return @($State.tasks | Where-Object { [string]$_.id -eq $Id }) | Select-Object -First 1
}

function Normalize-Capabilities {
    param([string[]]$Values)
    $result = @()
    foreach ($value in @($Values)) {
        $result += @([string]$value -split ',' | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ })
    }
    return @($result | Sort-Object -Unique)
}

function Initialize-State {
    if ((Test-Path -LiteralPath $statePath) -and -not $Force) {
        throw "State already exists: $statePath (use -Force only for an intentional local reset)"
    }
    $goal = Read-JsonFile $goalPath
    $policy = Read-JsonFile $policyPath
    $bootstrap = Read-JsonFile $bootstrapPath
    $tasks = @()
    foreach ($item in @($bootstrap.items)) {
        $tasks += [pscustomobject][ordered]@{
            id = [string]$item.id
            kind = [string]$item.kind
            priority = [int]$item.priority
            goal_revision = [int]$bootstrap.goal_revision
            contract_paths = @($item.contract_paths)
            acceptance_ids = @($item.acceptance_ids)
            depends_on = @($item.depends_on)
            required_capabilities = @($item.required_capabilities)
            locks = @($item.locks)
            resources = @($item.resources)
            write_set = @($item.write_set)
            verification = [string]$item.verification
            state = if (@($item.depends_on).Count -eq 0) { 'READY' } else { 'WAITING_DEPENDENCY' }
            attempt = 0
            review_round = 0
            evidence_status = 'NOT_RUN'
            integration_status = 'NOT_INTEGRATED'
            implementer_id = $null
            candidate_commit = $null
            latest_failure = $null
            context_ack = $null
            lease = $null
            accepted_at = $null
        }
    }
    $state = [pscustomobject][ordered]@{
        schema_version = 1
        goal_id = [string]$goal.goal_id
        goal_revision = [int]$goal.revision
        goal_digest = Get-PathDigest $goalPath
        goal_status = 'ACTIVE'
        controller_epoch = 0
        next_fencing_epoch = 1
        created_at = Get-UtcNowText
        updated_at = Get-UtcNowText
        policy_snapshot = [pscustomobject]@{
            lease_minutes = [int]$policy.lease_minutes
            quarantine_minutes = [int]$policy.quarantine_minutes
            max_claims_per_worker = [int]$policy.worker_pool.max_claims_per_worker
            resources = $policy.resources
        }
        workers = @()
        tasks = $tasks
        processed_event_ids = @()
        diagnostics = @()
    }
    Write-JsonAtomic $statePath $state
    Write-JsonAtomic $actionsPath ([pscustomobject]@{ generated_at = Get-UtcNowText; actions = @() })
    Write-Host "[PASS] initialized goal=$($state.goal_id) revision=$($state.goal_revision) tasks=$($tasks.Count) root=$controlRoot"
}

function Register-WorkerInternal {
    param([object]$State, [string]$Id, [string[]]$Caps)
    if ([string]::IsNullOrWhiteSpace($Id)) { throw 'AgentId is required' }
    $worker = Find-Worker $State $Id
    $normalized = Normalize-Capabilities $Caps
    if ($null -eq $worker) {
        $worker = [pscustomobject][ordered]@{
            worker_id = $Id
            capabilities = $normalized
            state = 'AVAILABLE'
            heartbeat_at = Get-UtcNowText
            current_lease_id = $null
            current_task_id = $null
            message_cursor = 0
        }
        $State.workers = @($State.workers) + @($worker)
    } else {
        if ($normalized.Count -gt 0) { $worker.capabilities = $normalized }
        $worker.heartbeat_at = Get-UtcNowText
        if ([string]$worker.state -eq 'OFFLINE') { $worker.state = 'AVAILABLE' }
    }
    return $worker
}

function Release-TaskLease {
    param([object]$State, [object]$Task)
    if ($null -ne $Task.lease) {
        $worker = Find-Worker $State ([string]$Task.lease.worker_id)
        if ($null -ne $worker -and [string]$worker.current_lease_id -eq [string]$Task.lease.lease_id) {
            $worker.current_lease_id = $null
            $worker.current_task_id = $null
            $worker.state = 'AVAILABLE'
            $worker.heartbeat_at = Get-UtcNowText
        }
    }
    $Task.lease = $null
}

function Test-PathOverlap {
    param([string]$Left, [string]$Right)
    function Normalize([string]$Value) {
        $normalized = $Value.Replace('\', '/').Trim().TrimStart('./').TrimEnd('/')
        if ($normalized.EndsWith('/**')) { $normalized = $normalized.Substring(0, $normalized.Length - 3).TrimEnd('/') }
        return $normalized.ToLowerInvariant()
    }
    $a = Normalize $Left
    $b = Normalize $Right
    if (-not $a -or -not $b) { return $true }
    if ($a -match '[*?\[]' -or $b -match '[*?\[]') { return $true }
    return $a -eq $b -or $a.StartsWith($b + '/') -or $b.StartsWith($a + '/')
}

function Test-DependenciesAccepted {
    param([object]$State, [object]$Task)
    foreach ($dependency in @($Task.depends_on)) {
        $dependencyTask = Find-Task $State ([string]$dependency)
        if ($null -eq $dependencyTask -or [string]$dependencyTask.state -ne 'ACCEPTED') { return $false }
    }
    return $true
}

function Get-TaskRequiredResources {
    param([object]$Task)
    if ([string]$Task.state -eq 'WAITING_VERIFICATION') {
        return @(@($Task.resources) + @('BROWSER_PROFILE', 'GOLDEN_E2E') | Sort-Object -Unique)
    }
    return @($Task.resources)
}

function Test-WorkerCapabilityMatch {
    param([object]$Worker, [object]$Task)
    $caps = @($Worker.capabilities | ForEach-Object { ([string]$_).ToLowerInvariant() })
    if ([string]$Task.state -eq 'WAITING_VERIFICATION') {
        if ([string]$Task.implementer_id -eq [string]$Worker.worker_id) { return $false }
        return $caps -contains 'browser' -and $caps -contains 'review'
    }
    foreach ($required in @($Task.required_capabilities)) {
        if ($caps -notcontains ([string]$required).ToLowerInvariant()) { return $false }
    }
    return $true
}

function Test-ClaimsAvailable {
    param([object]$State, [object]$Candidate)
    $active = @($State.tasks | Where-Object { $null -ne $_.lease -and [string]$_.id -ne [string]$Candidate.id })
    if ([string]$Candidate.state -ne 'WAITING_VERIFICATION') {
        foreach ($task in $active) {
            if ([string]$task.state -eq 'VERIFYING') { continue }
            foreach ($left in @($Candidate.locks)) {
                if (@($task.lease.locks) -contains [string]$left) { return $false }
            }
            foreach ($left in @($Candidate.write_set)) {
                foreach ($right in @($task.lease.write_set)) {
                    if (Test-PathOverlap $left $right) { return $false }
                }
            }
        }
    }

    $policy = $State.policy_snapshot.resources
    foreach ($resource in @(Get-TaskRequiredResources $Candidate)) {
        $capacity = 1
        if ($policy.PSObject.Properties.Name -contains [string]$resource) { $capacity = [int]$policy.$resource }
        $used = @($active | Where-Object { @($_.lease.resources) -contains [string]$resource }).Count
        if ($used -ge $capacity) { return $false }
    }
    return $true
}

function Write-WorkOrder {
    param([object]$State, [object]$Task, [object]$Worker)
    $phase = if ([string]$Task.state -eq 'VERIFYING') { 'VERIFY' } else { 'IMPLEMENT' }
    $nextAction = if ($phase -eq 'VERIFY') {
        "Independently run journey $($Task.verification) on exact candidate/integration commit and emit REVIEW_RESULT."
    } else {
        "Implement only task $($Task.id), update handoff, and emit COMPLETE_CANDIDATE; do not self-accept."
    }
    $contextPaths = @(
        'project-ops/AI-DEVELOPMENT-CONTRACT.md',
        'project-ops/control-plane/goal.json',
        'project-ops/control-plane/bootstrap-work-items.json'
    ) + @($Task.contract_paths)
    $contextManifest = @()
    foreach ($relative in @($contextPaths | Sort-Object -Unique)) {
        $absolute = [System.IO.Path]::GetFullPath((Join-Path $repoRoot ([string]$relative)))
        $relativeCheck = [System.IO.Path]::GetRelativePath($repoRoot, $absolute)
        if ($relativeCheck -eq '..' -or $relativeCheck.StartsWith('..\') -or $relativeCheck.StartsWith('../') -or [System.IO.Path]::IsPathRooted($relativeCheck)) {
            throw "Context path escapes repository: $relative"
        }
        if (-not (Test-Path -LiteralPath $absolute -PathType Leaf)) {
            throw "Context file is missing: $relative"
        }
        $purpose = if ($relative -eq 'project-ops/control-plane/goal.json') { 'immutable_goal_revision' }
            elseif ($relative -eq 'project-ops/AI-DEVELOPMENT-CONTRACT.md') { 'stable_engineering_rules' }
            elseif ($relative -eq 'project-ops/control-plane/bootstrap-work-items.json') { 'current_task_definition_and_dag' }
            else { 'acceptance_or_feature_contract' }
        $contextManifest += [pscustomobject][ordered]@{
            path = ([string]$relative).Replace('\', '/')
            sha256 = Get-PathDigest $absolute
            purpose = $purpose
            scope = $Task.id
            bytes = (Get-Item -LiteralPath $absolute).Length
        }
    }
    $contextBytes = [long](($contextManifest | Measure-Object -Property bytes -Sum).Sum)
    if ($contextBytes -gt 49152) { throw "Work order context exceeds 48 KiB hard limit: $contextBytes" }
    $head = ([string](git -C $repoRoot rev-parse HEAD)).Trim()
    $branch = ([string](git -C $repoRoot branch --show-current)).Trim()
    $contextManifestDigestSource = @($contextManifest | ForEach-Object { "$($_.path):$($_.sha256)" }) -join "`n"
    $digestBytes = [System.Text.Encoding]::UTF8.GetBytes($contextManifestDigestSource)
    $digestAlgorithm = [System.Security.Cryptography.SHA256]::Create()
    try { $contextManifestDigest = ([BitConverter]::ToString($digestAlgorithm.ComputeHash($digestBytes))).Replace('-', '').ToLowerInvariant() }
    finally { $digestAlgorithm.Dispose() }
    $order = [pscustomobject][ordered]@{
        schema_version = 1
        generated_at = Get-UtcNowText
        goal = [pscustomobject]@{
            id = $State.goal_id
            revision = $State.goal_revision
            digest = $State.goal_digest
            status = $State.goal_status
        }
        worker_id = $Worker.worker_id
        dispatch_source = [pscustomobject]@{
            repository = $repoRoot
            worktree = $repoRoot
            branch = $branch
            base_commit = $head
            expected_task_branch = "task/$(([string]$Task.id).ToLowerInvariant())"
        }
        phase = $phase
        task_id = $Task.id
        attempt = $Task.attempt
        review_round = $Task.review_round
        lease_id = $Task.lease.lease_id
        fencing_epoch = $Task.lease.fencing_epoch
        expires_at = $Task.lease.expires_at
        dependencies = @($Task.depends_on)
        acceptance_ids = @($Task.acceptance_ids)
        locks = @($Task.lease.locks)
        resources = @($Task.lease.resources)
        write_set = @($Task.lease.write_set)
        verification = $Task.verification
        contract_paths = @($Task.contract_paths)
        context_manifest = $contextManifest
        context_manifest_digest = $contextManifestDigest
        context_bytes = $contextBytes
        latest_failure = $Task.latest_failure
        next_action = $nextAction
        stable_prompt = if ($phase -eq 'VERIFY') {
            'project-ops/control-plane/prompts/verifier-ticket.md'
        } else {
            'project-ops/control-plane/prompts/worker-ticket.md'
        }
    }
    Write-JsonAtomic (Join-Path $workOrdersDir ($Worker.worker_id + '.json')) $order
    return $order
}

function Assign-Task {
    param([object]$State, [object]$Task, [object]$Worker, [System.Collections.Generic.List[object]]$Actions)
    $isVerification = [string]$Task.state -eq 'WAITING_VERIFICATION'
    if (-not $isVerification) { $Task.attempt = [int]$Task.attempt + 1 }
    $leaseIdValue = [Guid]::NewGuid().ToString('D')
    $epoch = [int]$State.next_fencing_epoch
    $State.next_fencing_epoch = $epoch + 1
    $issued = [DateTime]::UtcNow
    $Task.lease = [pscustomobject][ordered]@{
        lease_id = $leaseIdValue
        worker_id = $Worker.worker_id
        fencing_epoch = $epoch
        issued_at = $issued.ToString('o')
        heartbeat_at = $issued.ToString('o')
        expires_at = $issued.AddMinutes([int]$State.policy_snapshot.lease_minutes).ToString('o')
        locks = if ($isVerification) { @() } else { @($Task.locks | Sort-Object) }
        resources = @(Get-TaskRequiredResources $Task | Sort-Object)
        write_set = if ($isVerification) { @("runtime-local/control-plane/evidence/$($Task.id)/**") } else { @($Task.write_set) }
    }
    $Task.context_ack = $null
    $Task.state = if ($isVerification) { 'VERIFYING' } else { 'IMPLEMENTING' }
    $Task.evidence_status = if ($isVerification) { 'RUNNING' } else { $Task.evidence_status }
    $Worker.state = 'BUSY'
    $Worker.current_lease_id = $leaseIdValue
    $Worker.current_task_id = $Task.id
    $Worker.heartbeat_at = $issued.ToString('o')
    $order = Write-WorkOrder $State $Task $Worker
    $Actions.Add([pscustomobject]@{
        type = if ($isVerification) { 'VERIFY' } else { 'DISPATCH' }
        task_id = $Task.id
        worker_id = $Worker.worker_id
        lease_id = $leaseIdValue
        fencing_epoch = $epoch
        work_order = "runtime-local/control-plane/work-orders/$($Worker.worker_id).json"
        next_action = $order.next_action
    }) | Out-Null
}

function Schedule-Workers {
    param([object]$State, [System.Collections.Generic.List[object]]$Actions, [string]$OnlyAgentId)
    if ([string]$State.goal_status -ne 'ACTIVE') { return }
    foreach ($task in @($State.tasks)) {
        if ([string]$task.state -eq 'WAITING_DEPENDENCY' -and (Test-DependenciesAccepted $State $task)) {
            $task.state = 'READY'
        }
    }
    $workers = @($State.workers | Where-Object {
        [string]$_.state -eq 'AVAILABLE' -and
        ([string]::IsNullOrWhiteSpace($OnlyAgentId) -or [string]$_.worker_id -eq $OnlyAgentId)
    } | Sort-Object worker_id)

    foreach ($worker in $workers) {
        $candidates = @($State.tasks | Where-Object {
            @('READY', 'NEEDS_REWORK', 'RECOVERY_READY', 'WAITING_VERIFICATION') -contains [string]$_.state -and
            [int]$_.goal_revision -eq [int]$State.goal_revision -and
            (Test-DependenciesAccepted $State $_) -and
            (Test-WorkerCapabilityMatch $worker $_) -and
            (Test-ClaimsAvailable $State $_)
        } | Sort-Object @{Expression = { [int]$_.priority }; Descending = $true}, @{Expression = { [string]$_.id }; Descending = $false})
        if ($candidates.Count -gt 0) { Assign-Task $State $candidates[0] $worker $Actions }
    }
}

function Test-EventLease {
    param([object]$Task, [object]$Event)
    if ($null -eq $Task.lease) { return 'Task has no active lease' }
    if ([string]$Task.lease.lease_id -ne [string]$Event.lease_id) { return 'lease_id mismatch' }
    if ([int]$Task.lease.fencing_epoch -ne [int]$Event.fencing_epoch) { return 'fencing_epoch mismatch' }
    if ([string]$Task.lease.worker_id -ne [string]$Event.agent_id) { return 'worker mismatch' }
    return $null
}

function Process-Events {
    param([object]$State, [System.Collections.Generic.List[object]]$Actions)
    $eventFiles = @(Get-ChildItem -LiteralPath $incomingDir -Filter '*.json' -File | Sort-Object Name)
    foreach ($file in $eventFiles) {
        $event = $null
        $rejection = $null
        try { $event = Read-JsonFile $file.FullName } catch { $rejection = "Invalid JSON: $($_.Exception.Message)" }
        if ($null -ne $event) {
            $eventId = [string]$event.event_id
            if ([string]::IsNullOrWhiteSpace($eventId)) { $rejection = 'Missing event_id' }
            elseif (@($State.processed_event_ids) -contains $eventId) {
                Move-Item -LiteralPath $file.FullName -Destination (Join-Path $processedDir $file.Name) -Force
                continue
            }
            $task = if ($event.task_id) { Find-Task $State ([string]$event.task_id) } else { $null }
            $worker = Find-Worker $State ([string]$event.agent_id)
            if ($null -eq $worker) { $rejection = 'Unknown worker' }
            $controllerEvent = @('INTEGRATION_RESULT', 'AUTHORITY_REQUIRED') -contains [string]$event.type
            if ($controllerEvent) {
                if ($null -eq $worker -or (@($worker.capabilities) -notcontains 'controller' -and @($worker.capabilities) -notcontains 'integration')) {
                    $rejection = 'Controller/integration capability required'
                }
            } elseif ([string]$event.type -ne 'WORKER_HEARTBEAT') {
                if ($null -eq $task) { $rejection = 'Unknown task' }
                elseif (-not $rejection) { $rejection = Test-EventLease $task $event }
                if (-not $rejection -and [string]$event.goal_digest -ne [string]$State.goal_digest) {
                    $rejection = 'goal_digest mismatch; REPLAN_REQUIRED'
                }
            }

            if (-not $rejection) {
                $worker.heartbeat_at = Get-UtcNowText
                switch ([string]$event.type) {
                    'WORKER_HEARTBEAT' { }
                    'CONTEXT_ACK' {
                        if ([string]$event.payload.context_manifest_digest -notmatch '^[0-9a-f]{64}$') {
                            $rejection = 'CONTEXT_ACK requires context_manifest_digest'
                            break
                        }
                        $task.context_ack = [pscustomobject]@{
                            lease_id = [string]$event.lease_id
                            fencing_epoch = [int]$event.fencing_epoch
                            context_manifest_digest = [string]$event.payload.context_manifest_digest
                            acknowledged_at = Get-UtcNowText
                        }
                    }
                    'TASK_HEARTBEAT' {
                        $task.lease.heartbeat_at = Get-UtcNowText
                        $task.lease.expires_at = [DateTime]::UtcNow.AddMinutes([int]$State.policy_snapshot.lease_minutes).ToString('o')
                    }
                    'CHECKPOINT' {
                        $task.lease.heartbeat_at = Get-UtcNowText
                        $task.lease.expires_at = [DateTime]::UtcNow.AddMinutes([int]$State.policy_snapshot.lease_minutes).ToString('o')
                    }
                    'COMPLETE_CANDIDATE' {
                        if ($null -eq $task.context_ack -or [string]$task.context_ack.lease_id -ne [string]$event.lease_id) {
                            $rejection = 'CONTEXT_ACK required before COMPLETE_CANDIDATE'
                            break
                        }
                        $candidate = [string]$event.payload.candidate_commit
                        if ($candidate -notmatch '^[0-9a-f]{40}$') {
                            $rejection = 'COMPLETE_CANDIDATE requires full candidate_commit'
                            break
                        }
                        $task.candidate_commit = $candidate
                        $task.implementer_id = [string]$event.agent_id
                        $task.state = 'WAITING_VERIFICATION'
                        $task.evidence_status = 'NOT_RUN'
                        Release-TaskLease $State $task
                        $Actions.Add([pscustomobject]@{ type = 'VERIFY_READY'; task_id = $task.id; candidate_commit = $candidate }) | Out-Null
                    }
                    'REVIEW_RESULT' {
                        if ($null -eq $task.context_ack -or [string]$task.context_ack.lease_id -ne [string]$event.lease_id) {
                            $rejection = 'CONTEXT_ACK required before REVIEW_RESULT'
                            break
                        }
                        $verdict = [string]$event.payload.verdict
                        Release-TaskLease $State $task
                        $task.review_round = [int]$task.review_round + 1
                        if ($verdict -eq 'VERIFIED') {
                            $task.state = 'WAITING_INTEGRATION'
                            $task.evidence_status = 'VERIFIED'
                            $task.integration_status = 'QUEUED'
                            $Actions.Add([pscustomobject]@{ type = 'INTEGRATE'; task_id = $task.id; candidate_commit = $task.candidate_commit; evidence_manifest = $event.payload.evidence_manifest }) | Out-Null
                        } elseif ($verdict -eq 'REJECTED') {
                            foreach ($requiredField in @('failed_acceptance_id', 'journey_step_id', 'expected', 'observed', 'reproduction', 'failure_class', 'required_repair_outcome')) {
                                if ([string]::IsNullOrWhiteSpace([string]$event.payload.$requiredField)) {
                                    $rejection = "REJECTED verdict missing $requiredField"
                                    break
                                }
                            }
                            if ($rejection) { break }
                            $task.state = 'NEEDS_REWORK'
                            $task.evidence_status = 'REJECTED'
                            $task.latest_failure = $event.payload
                            $Actions.Add([pscustomobject]@{ type = 'REWORK'; task_id = $task.id; review_round = $task.review_round; failure = $event.payload }) | Out-Null
                        } else {
                            $task.state = 'WAITING_ENVIRONMENT'
                            $task.evidence_status = 'ENVIRONMENT_BLOCKED'
                            $task.latest_failure = $event.payload
                        }
                    }
                    'BLOCKED' {
                        Release-TaskLease $State $task
                        $task.state = if ($event.payload.authority_required -eq $true) { 'WAITING_AUTHORITY' } else { 'NEEDS_REWORK' }
                        $task.latest_failure = $event.payload
                        if ($event.payload.authority_required -eq $true) {
                            $Actions.Add([pscustomobject]@{ type = 'AUTHORITY_REQUIRED'; task_id = $task.id; question = $event.payload.question }) | Out-Null
                        }
                    }
                    'INTEGRATION_RESULT' {
                        if ($null -eq $task) { $rejection = 'Unknown task'; break }
                        if ([string]$event.payload.verdict -eq 'INTEGRATED_VERIFIED') {
                            $task.state = 'ACCEPTED'
                            $task.integration_status = 'INTEGRATED_VERIFIED'
                            $task.accepted_at = Get-UtcNowText
                        } else {
                            $task.state = 'NEEDS_REWORK'
                            $task.integration_status = 'REJECTED'
                            $task.latest_failure = $event.payload
                        }
                    }
                    'AUTHORITY_REQUIRED' {
                        $State.goal_status = 'WAITING_AUTHORITY'
                        $Actions.Add([pscustomobject]@{ type = 'AUTHORITY_REQUIRED'; task_id = $event.task_id; question = $event.payload.question }) | Out-Null
                    }
                    default { $rejection = "Unsupported event type: $($event.type)" }
                }
            }

            if (-not $rejection) { $State.processed_event_ids = @($State.processed_event_ids) + @($eventId) }
        }

        if ($rejection) {
            $Actions.Add([pscustomobject]@{ type = 'REJECT_EVENT'; file = $file.Name; reason = $rejection }) | Out-Null
            Move-Item -LiteralPath $file.FullName -Destination (Join-Path $rejectedDir $file.Name) -Force
        } else {
            Move-Item -LiteralPath $file.FullName -Destination (Join-Path $processedDir $file.Name) -Force
        }
    }
}

function Expire-Leases {
    param([object]$State, [System.Collections.Generic.List[object]]$Actions)
    $now = [DateTime]::UtcNow
    foreach ($task in @($State.tasks | Where-Object { $null -ne $_.lease })) {
        $expires = [DateTime]::Parse([string]$task.lease.expires_at).ToUniversalTime()
        if ($expires -lt $now) {
            $oldLease = $task.lease
            Release-TaskLease $State $task
            $task.state = 'ORPHANED_QUARANTINE'
            $task.latest_failure = [pscustomobject]@{
                reason = 'LEASE_EXPIRED'
                lease_id = $oldLease.lease_id
                fencing_epoch = $oldLease.fencing_epoch
                quarantine_until = $now.AddMinutes([int]$State.policy_snapshot.quarantine_minutes).ToString('o')
            }
            $Actions.Add([pscustomobject]@{ type = 'RECOVERY_AUDIT'; task_id = $task.id; old_lease_id = $oldLease.lease_id }) | Out-Null
        }
    }
    foreach ($task in @($State.tasks | Where-Object { [string]$_.state -eq 'ORPHANED_QUARANTINE' })) {
        $until = [DateTime]::Parse([string]$task.latest_failure.quarantine_until).ToUniversalTime()
        if ($until -le $now) { $task.state = 'RECOVERY_READY' }
    }
}

function Update-GoalStatus {
    param([object]$State, [System.Collections.Generic.List[object]]$Actions)
    if ([string]$State.goal_status -eq 'WAITING_AUTHORITY') { return }
    $goal = Read-JsonFile $goalPath
    $satisfied = @()
    foreach ($task in @($State.tasks | Where-Object { [string]$_.state -eq 'ACCEPTED' })) {
        $satisfied += @($task.acceptance_ids)
    }
    $missing = @($goal.acceptance_items | Where-Object { $satisfied -notcontains [string]$_.id } | ForEach-Object { [string]$_.id })
    $finalTask = Find-Task $State 'P0-INTEGRATED-GOLDEN-LOOP-VERIFY'
    if ($missing.Count -eq 0 -and $null -ne $finalTask -and [string]$finalTask.state -eq 'ACCEPTED') {
        $State.goal_status = 'COMPLETED'
        $Actions.Add([pscustomobject]@{ type = 'GOAL_COMPLETE'; goal_id = $State.goal_id }) | Out-Null
    } elseif ($missing.Count -gt 0 -and @($State.tasks | Where-Object { [string]$_.state -notin @('ACCEPTED', 'WAITING_AUTHORITY') }).Count -eq 0) {
        $Actions.Add([pscustomobject]@{ type = 'PLAN_GAP'; missing_acceptance_ids = $missing }) | Out-Null
    }
}

function Invoke-TickInternal {
    param([object]$State, [string]$OnlyAgentId)
    $actions = [System.Collections.Generic.List[object]]::new()
    $State.controller_epoch = [int]$State.controller_epoch + 1
    Process-Events $State $actions
    Expire-Leases $State $actions
    Schedule-Workers $State $actions $OnlyAgentId
    Update-GoalStatus $State $actions
    if ($actions.Count -eq 0) { $actions.Add([pscustomobject]@{ type = 'NOOP'; reason = 'No state transition or safe dispatch available' }) | Out-Null }
    $State.updated_at = Get-UtcNowText
    Write-JsonAtomic $statePath $State
    Write-JsonAtomic $actionsPath ([pscustomobject]@{ generated_at = Get-UtcNowText; controller_epoch = $State.controller_epoch; actions = @($actions) })
    return $actions
}

function Emit-Event {
    if ([string]::IsNullOrWhiteSpace($AgentId)) { throw 'AgentId is required' }
    $payload = [pscustomobject]@{}
    if (-not [string]::IsNullOrWhiteSpace($PayloadFile)) { $payload = Read-JsonFile (Resolve-Path -LiteralPath $PayloadFile).Path }
    $state = Require-State
    $worker = Find-Worker $state $AgentId
    if ($null -eq $worker) { throw "Worker is not registered: $AgentId" }
    $effectiveTaskId = $TaskId
    $effectiveLeaseId = $LeaseId
    $effectiveEpoch = $FencingEpoch
    if ([string]::IsNullOrWhiteSpace($effectiveTaskId)) { $effectiveTaskId = [string]$worker.current_task_id }
    if ([string]::IsNullOrWhiteSpace($effectiveLeaseId)) { $effectiveLeaseId = [string]$worker.current_lease_id }
    if ($effectiveEpoch -eq 0 -and $effectiveTaskId) {
        $task = Find-Task $state $effectiveTaskId
        if ($null -ne $task -and $null -ne $task.lease) { $effectiveEpoch = [int]$task.lease.fencing_epoch }
    }
    $event = [pscustomobject][ordered]@{
        schema_version = 1
        event_id = [Guid]::NewGuid().ToString('D')
        type = $EventType
        occurred_at = Get-UtcNowText
        agent_id = $AgentId
        task_id = $effectiveTaskId
        lease_id = $effectiveLeaseId
        fencing_epoch = $effectiveEpoch
        goal_digest = [string]$state.goal_digest
        payload = $payload
    }
    $path = Join-Path $incomingDir ($event.event_id + '.json')
    Write-JsonAtomic $path $event
    Write-Host "[PASS] emitted type=$EventType event=$($event.event_id) task=$effectiveTaskId"
}

function Show-Context {
    if ([string]::IsNullOrWhiteSpace($AgentId)) { throw 'AgentId is required' }
    $state = Require-State
    $worker = Find-Worker $state $AgentId
    Write-Output '# MVP CONTROL CONTEXT'
    Write-Output "goal_id: $($state.goal_id)"
    Write-Output "goal_revision: $($state.goal_revision)"
    Write-Output "goal_digest: $($state.goal_digest)"
    Write-Output "goal_status: $($state.goal_status)"
    Write-Output "controller_epoch: $($state.controller_epoch)"
    if ($null -eq $worker) {
        Write-Output 'worker_status: NOT_REGISTERED'
        Write-Output 'next_action: register this worker; do not resume old chat instructions'
        return
    }
    Write-Output "worker_status: $($worker.state)"
    Write-Output "capabilities: $(@($worker.capabilities) -join ',')"
    if ([string]::IsNullOrWhiteSpace([string]$worker.current_lease_id)) {
        Write-Output 'lease_status: NONE'
        Write-Output 'next_action: wait for or claim a safe work ticket; do not write feature code'
    } else {
        $orderPath = Join-Path $workOrdersDir ($AgentId + '.json')
        $order = Read-JsonFile $orderPath
        $currentGoalDigest = Get-PathDigest $goalPath
        if ([string]$order.goal.digest -ne $currentGoalDigest -or [string]$state.goal_digest -ne $currentGoalDigest) {
            throw 'REPLAN_REQUIRED: Goal digest changed after this work order was issued'
        }
        if ([DateTimeOffset]::Parse([string]$order.expires_at).UtcDateTime -lt [DateTime]::UtcNow) {
            throw 'REPLAN_REQUIRED: work order lease expired'
        }
        $contextBytes = 0L
        foreach ($entry in @($order.context_manifest)) {
            $contextPath = [System.IO.Path]::GetFullPath((Join-Path $repoRoot ([string]$entry.path)))
            $relativeCheck = [System.IO.Path]::GetRelativePath($repoRoot, $contextPath)
            if ($relativeCheck -eq '..' -or $relativeCheck.StartsWith('..\') -or $relativeCheck.StartsWith('../') -or [System.IO.Path]::IsPathRooted($relativeCheck)) {
                throw "REPLAN_REQUIRED: context path escapes repository: $($entry.path)"
            }
            if (-not (Test-Path -LiteralPath $contextPath -PathType Leaf)) {
                throw "REPLAN_REQUIRED: context file missing: $($entry.path)"
            }
            if ((Get-PathDigest $contextPath) -ne [string]$entry.sha256) {
                throw "REPLAN_REQUIRED: context hash changed: $($entry.path)"
            }
            $contextBytes += (Get-Item -LiteralPath $contextPath).Length
        }
        if ($contextBytes -gt 49152) { throw "REPLAN_REQUIRED: context exceeds 48 KiB: $contextBytes" }
        $ackEvent = [pscustomobject][ordered]@{
            schema_version = 1
            event_id = [Guid]::NewGuid().ToString('D')
            type = 'CONTEXT_ACK'
            occurred_at = Get-UtcNowText
            agent_id = $AgentId
            task_id = [string]$worker.current_task_id
            lease_id = [string]$worker.current_lease_id
            fencing_epoch = [int]$order.fencing_epoch
            goal_digest = [string]$state.goal_digest
            payload = [pscustomobject]@{ context_manifest_digest = [string]$order.context_manifest_digest }
        }
        Write-JsonAtomic (Join-Path $incomingDir ($ackEvent.event_id + '.json')) $ackEvent
        Write-Output "lease_id: $($worker.current_lease_id)"
        Write-Output "task_id: $($worker.current_task_id)"
        Write-Output '===== WORK ORDER ====='
        Get-Content -LiteralPath $orderPath -Raw -Encoding UTF8
        Write-Output '===== END WORK ORDER ====='
    }
    Write-Output '===== LIVE GIT ====='
    git -C $repoRoot status --short --branch
    git -C $repoRoot log -3 --oneline
}

Ensure-Directories

switch ($Action) {
    'init' {
        Invoke-WithControlLock { Initialize-State }
    }
    'register' {
        Invoke-WithControlLock {
            $state = Require-State
            $worker = Register-WorkerInternal $state $AgentId $Capabilities
            $state.updated_at = Get-UtcNowText
            Write-JsonAtomic $statePath $state
            Write-Host "[PASS] registered worker=$($worker.worker_id) capabilities=$(@($worker.capabilities) -join ',')"
        }
    }
    'tick' {
        Invoke-WithControlLock {
            $state = Require-State
            $actions = Invoke-TickInternal $state $null
            $actions | ConvertTo-Json -Depth 20
        }
    }
    'claim' {
        if ([string]::IsNullOrWhiteSpace($AgentId)) { throw 'AgentId is required' }
        Invoke-WithControlLock {
            $state = Require-State
            [void](Register-WorkerInternal $state $AgentId $Capabilities)
            $actions = Invoke-TickInternal $state $AgentId
            $actions | ConvertTo-Json -Depth 20
        }
    }
    'heartbeat' {
        $EventType = if ($TaskId) { 'TASK_HEARTBEAT' } else { 'WORKER_HEARTBEAT' }
        Emit-Event
    }
    'emit' {
        if ([string]::IsNullOrWhiteSpace($EventType)) { throw 'EventType is required for emit' }
        Emit-Event
    }
    'context' { Show-Context }
    'status' {
        $state = Require-State
        $summary = [pscustomobject]@{
            goal_id = $state.goal_id
            goal_revision = $state.goal_revision
            goal_status = $state.goal_status
            controller_epoch = $state.controller_epoch
            workers = @($state.workers | Select-Object worker_id, state, current_task_id, heartbeat_at)
            tasks = @($state.tasks | Select-Object id, state, attempt, review_round, evidence_status, integration_status, implementer_id)
            actions_file = $actionsPath
        }
        $summary | ConvertTo-Json -Depth 20
    }
}
