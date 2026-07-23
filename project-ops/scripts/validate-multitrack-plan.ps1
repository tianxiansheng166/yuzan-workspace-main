param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$registryPath = Join-Path $repoRoot 'project-ops\multitrack-tasks.json'
$acceptedPath = Join-Path $repoRoot 'project-ops\accepted-baselines.json'

foreach ($requiredFile in @($registryPath, $acceptedPath)) {
    if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
        throw "Required registry not found: $requiredFile"
    }
}

$registry = Get-Content -LiteralPath $registryPath -Raw -Encoding UTF8 |
    ConvertFrom-Json
$accepted = Get-Content -LiteralPath $acceptedPath -Raw -Encoding UTF8 |
    ConvertFrom-Json
$failures = [System.Collections.Generic.List[string]]::new()

function Add-Failure {
    param([string]$Message)
    $failures.Add($Message)
}

function Get-RemoteBranchHead {
    param([string]$Branch)

    $remoteOutput = @(& git -C $repoRoot ls-remote --heads origin $Branch 2>&1)
    if ($LASTEXITCODE -ne 0) {
        Add-Failure "Unable to query origin/$Branch"
        return $null
    }

    $matchingLines = @($remoteOutput | Where-Object {
        [string]$_ -match "^[0-9a-fA-F]{40}\s+refs/heads/$([regex]::Escape($Branch))$"
    })
    if ($matchingLines.Count -ne 1) {
        Add-Failure "Expected exactly one remote head for origin/$Branch"
        return $null
    }

    return (([string]$matchingLines[0]) -split '\s+')[0].ToLowerInvariant()
}

function Test-LocalCommit {
    param([string]$Commit)

    & git -C $repoRoot cat-file -e "$Commit^{commit}" 2>$null
    return $LASTEXITCODE -eq 0
}

$validDispatchStatuses = @(
    'READY_TO_RESUME',
    'READY_TO_DISPATCH',
    'WAITING_DEPENDENCY',
    'WAITING_REVIEW',
    'CLOSED',
    'BLOCKED'
)
$validExecutionStatuses = @(
    'NOT_CREATED',
    'PLANNED',
    'IN_PROGRESS',
    'READY_FOR_REVIEW',
    'COMPLETED',
    'BLOCKED'
)
$validEvidenceStatuses = @(
    'NOT_STARTED',
    'PARTIAL',
    'EVIDENCE_REPAIR',
    'VERIFIED'
)
$validIntegrationStatuses = @('NOT_INTEGRATED', 'INTEGRATED')
$validAcceptanceStatuses = @('PENDING', 'VERIFIED', 'INTEGRATED', 'REJECTED')
$validBaseStrategies = @(
    'EXACT_COMMIT',
    'ACCEPTED_BASELINE',
    'ACCEPTED_DEPENDENCY_HEAD',
    'INTEGRATION_CHECKPOINT_CONTAINING_ALL_DEPENDENCIES'
)
$validControlStatuses = @(
    'CONTROL_PLANE_PENDING',
    'ACTIVE',
    'HARDENING',
    'READY_FOR_MAIN',
    'BLOCKED'
)

$acceptedById = @{}
foreach ($entry in @($accepted.entries)) {
    $key = [string]$entry.task_id
    if ($acceptedById.ContainsKey($key)) {
        Add-Failure "Duplicate accepted baseline id: $key"
        continue
    }
    $acceptedById[$key] = $entry

    if ($validAcceptanceStatuses -notcontains [string]$entry.acceptance_status) {
        Add-Failure "Accepted baseline $key has unsupported status: $($entry.acceptance_status)"
    }
    if ([string]$entry.acceptance_status -in @('VERIFIED', 'INTEGRATED')) {
        if ([string]$entry.commit -notmatch '^[0-9a-fA-F]{40}$') {
            Add-Failure "Accepted baseline $key requires a full 40-character commit"
            continue
        }

        $remoteHead = Get-RemoteBranchHead -Branch ([string]$entry.branch)
        if ($null -ne $remoteHead -and
            $remoteHead -ne ([string]$entry.commit).ToLowerInvariant()) {
            Add-Failure "Accepted baseline $key commit does not match origin/$($entry.branch)"
        }
    }
}

$taskIds = [System.Collections.Generic.HashSet[string]]::new(
    [StringComparer]::OrdinalIgnoreCase
)
foreach ($task in @($registry.tasks)) {
    if (-not $taskIds.Add([string]$task.id)) {
        Add-Failure "Duplicate registry task id: $($task.id)"
    }
}

$knownIds = [System.Collections.Generic.HashSet[string]]::new(
    [StringComparer]::OrdinalIgnoreCase
)
foreach ($entry in @($accepted.entries)) {
    $knownIds.Add([string]$entry.task_id) | Out-Null
}
foreach ($task in @($registry.tasks)) {
    $knownIds.Add([string]$task.id) | Out-Null
}
foreach ($baselineId in @($registry.external_baseline_ids)) {
    $baselineKey = [string]$baselineId
    $knownIds.Add($baselineKey) | Out-Null
    if (-not $acceptedById.ContainsKey($baselineKey)) {
        Add-Failure "External baseline id is not present in accepted-baselines: $baselineKey"
    }
}

$branches = [System.Collections.Generic.HashSet[string]]::new(
    [StringComparer]::OrdinalIgnoreCase
)
$worktrees = [System.Collections.Generic.HashSet[string]]::new(
    [StringComparer]::OrdinalIgnoreCase
)

$tasksById = @{}
foreach ($task in @($registry.tasks)) {
    $tasksById[[string]$task.id] = $task
}

foreach ($task in @($registry.tasks)) {
    foreach ($required in @(
        'id',
        'lane',
        'wave',
        'dispatch_status',
        'execution_status',
        'evidence_status',
        'integration_status',
        'branch',
        'worktree',
        'task_file',
        'base_ref',
        'base_strategy',
        'base_task_id',
        'depends_on',
        'shared_writes',
        'shared_locks',
        'prompt',
        'integration_rank'
    )) {
        if (-not ($task.PSObject.Properties.Name -contains $required)) {
            Add-Failure "Task $($task.id) is missing field: $required"
        }
    }

    if ($validDispatchStatuses -notcontains [string]$task.dispatch_status) {
        Add-Failure "Task $($task.id) has unsupported dispatch_status: $($task.dispatch_status)"
    }
    if ($validExecutionStatuses -notcontains [string]$task.execution_status) {
        Add-Failure "Task $($task.id) has unsupported execution_status: $($task.execution_status)"
    }
    if ($validEvidenceStatuses -notcontains [string]$task.evidence_status) {
        Add-Failure "Task $($task.id) has unsupported evidence_status: $($task.evidence_status)"
    }
    if ($validIntegrationStatuses -notcontains [string]$task.integration_status) {
        Add-Failure "Task $($task.id) has unsupported integration_status: $($task.integration_status)"
    }
    if ($validBaseStrategies -notcontains [string]$task.base_strategy) {
        Add-Failure "Task $($task.id) has unsupported base_strategy: $($task.base_strategy)"
    }
    if ([string]$task.branch -notmatch '^(task|hotfix)/[A-Za-z0-9._-]+$') {
        Add-Failure "Task $($task.id) has invalid branch: $($task.branch)"
    }
    if (-not $branches.Add([string]$task.branch)) {
        Add-Failure "Duplicate task branch: $($task.branch)"
    }
    if (-not $worktrees.Add([string]$task.worktree)) {
        Add-Failure "Duplicate task worktree: $($task.worktree)"
    }

    $promptPath = Join-Path $repoRoot ([string]$task.prompt)
    if (-not (Test-Path -LiteralPath $promptPath -PathType Leaf)) {
        Add-Failure "Task $($task.id) prompt does not exist: $($task.prompt)"
    }

    foreach ($sharedPath in @($task.shared_writes)) {
        if ([string]$sharedPath -match '(?i)(placeholder|selected-.+-after-discovery|tbd|todo)') {
            Add-Failure "Task $($task.id) has unresolved shared_writes placeholder: $sharedPath"
        }
    }
    foreach ($sharedLock in @($task.shared_locks)) {
        if ([string]::IsNullOrWhiteSpace([string]$sharedLock) -or
            [string]$sharedLock -notmatch '^[A-Z][A-Z0-9_]+$') {
            Add-Failure "Task $($task.id) has invalid shared lock: $sharedLock"
        }
    }

    foreach ($dependency in @($task.depends_on)) {
        if (-not $knownIds.Contains([string]$dependency)) {
            Add-Failure "Task $($task.id) has unknown dependency: $dependency"
        }
        if ([string]$dependency -eq [string]$task.id) {
            Add-Failure "Task $($task.id) depends on itself"
        }
    }

    $baseTaskId = [string]$task.base_task_id
    switch ([string]$task.base_strategy) {
        'EXACT_COMMIT' {
            if ([string]$task.base_ref -notmatch '^[0-9a-fA-F]{40}$') {
                Add-Failure "Task $($task.id) EXACT_COMMIT base_ref must be a full commit"
            }
            if (-not $acceptedById.ContainsKey($baseTaskId) -or
                [string]$acceptedById[$baseTaskId].commit -ne [string]$task.base_ref) {
                Add-Failure "Task $($task.id) exact base is not the accepted commit for $baseTaskId"
            }
        }
        'ACCEPTED_BASELINE' {
            if (@($task.depends_on) -notcontains $baseTaskId) {
                Add-Failure "Task $($task.id) accepted base_task_id must be one of its dependencies"
            }
            if ([string]$task.base_ref -ne "accepted:$baseTaskId") {
                Add-Failure "Task $($task.id) accepted base_ref must name base_task_id"
            }
        }
        'ACCEPTED_DEPENDENCY_HEAD' {
            if (@($task.depends_on) -notcontains $baseTaskId) {
                Add-Failure "Task $($task.id) base_task_id must be one of its dependencies"
            }
            if ([string]$task.base_ref -ne "accepted:$baseTaskId") {
                Add-Failure "Task $($task.id) dependency base_ref must name base_task_id"
            }
        }
        'INTEGRATION_CHECKPOINT_CONTAINING_ALL_DEPENDENCIES' {
            if ($baseTaskId -ne [string]$registry.integration.id) {
                Add-Failure "Task $($task.id) integration base_task_id is incorrect"
            }
            if ([string]$task.base_ref -ne "checkpoint:$baseTaskId") {
                Add-Failure "Task $($task.id) checkpoint base_ref must name integration"
            }
        }
    }

    $acceptedEntry = $null
    if ($acceptedById.ContainsKey([string]$task.id)) {
        $acceptedEntry = $acceptedById[[string]$task.id]
        if ([string]$acceptedEntry.branch -ne [string]$task.branch) {
            Add-Failure "Accepted task $($task.id) branch differs from registry"
        }
        if ([string]$acceptedEntry.acceptance_status -in @('VERIFIED', 'INTEGRATED')) {
            if ([string]$task.execution_status -ne 'COMPLETED' -or
                [string]$task.evidence_status -ne 'VERIFIED' -or
                [string]$task.dispatch_status -ne 'CLOSED') {
                Add-Failure "Accepted task $($task.id) must be CLOSED/COMPLETED with VERIFIED evidence"
            }
        }
        if ([string]$acceptedEntry.acceptance_status -eq 'INTEGRATED' -and
            [string]$task.integration_status -ne 'INTEGRATED') {
            Add-Failure "Integrated accepted task $($task.id) must have integration_status=INTEGRATED"
        }
    }

    if ([string]$task.dispatch_status -eq 'READY_TO_DISPATCH' -and
        [string]$task.execution_status -notin @('NOT_CREATED', 'PLANNED')) {
        Add-Failure "READY_TO_DISPATCH task $($task.id) has incompatible execution_status"
    }
    if ([string]$task.dispatch_status -eq 'READY_TO_RESUME' -and
        [string]$task.execution_status -notin @('PLANNED', 'IN_PROGRESS')) {
        Add-Failure "READY_TO_RESUME task $($task.id) has incompatible execution_status"
    }
    if ([string]$task.dispatch_status -eq 'BLOCKED' -and
        [string]$task.execution_status -ne 'BLOCKED') {
        Add-Failure "Blocked task $($task.id) must also have execution_status=BLOCKED"
    }
    if ([string]$task.dispatch_status -eq 'WAITING_REVIEW' -and
        [string]$task.execution_status -ne 'READY_FOR_REVIEW') {
        Add-Failure "WAITING_REVIEW task $($task.id) must have execution_status=READY_FOR_REVIEW"
    }
    if ([string]$task.dispatch_status -eq 'CLOSED' -and
        [string]$task.execution_status -ne 'COMPLETED') {
        Add-Failure "CLOSED task $($task.id) must have execution_status=COMPLETED"
    }
    if ([string]$task.execution_status -eq 'COMPLETED' -and
        ($null -eq $acceptedEntry -or
         [string]$acceptedEntry.acceptance_status -notin @('VERIFIED', 'INTEGRATED'))) {
        Add-Failure "Completed task $($task.id) requires an accepted baseline entry"
    }
    if ([string]$task.evidence_status -eq 'VERIFIED' -and
        ($null -eq $acceptedEntry -or
         [string]$acceptedEntry.acceptance_status -notin @('VERIFIED', 'INTEGRATED'))) {
        Add-Failure "Verified task $($task.id) requires an accepted baseline entry"
    }
    if ([string]$task.integration_status -eq 'INTEGRATED' -and
        ($null -eq $acceptedEntry -or
         [string]$acceptedEntry.acceptance_status -ne 'INTEGRATED')) {
        Add-Failure "Integrated task $($task.id) requires acceptance_status=INTEGRATED"
    }

    if ([string]$task.dispatch_status -in @('READY_TO_DISPATCH', 'READY_TO_RESUME')) {
        foreach ($dependency in @($task.depends_on)) {
            $dependencyKey = [string]$dependency
            if (-not $acceptedById.ContainsKey($dependencyKey) -or
                [string]$acceptedById[$dependencyKey].acceptance_status -notin @('VERIFIED', 'INTEGRATED')) {
                Add-Failure "Dispatch-ready task $($task.id) has unaccepted dependency: $dependencyKey"
            }
        }

        if ([string]$task.base_strategy -in @('ACCEPTED_BASELINE', 'ACCEPTED_DEPENDENCY_HEAD')) {
            if (-not $acceptedById.ContainsKey($baseTaskId) -or
                [string]$acceptedById[$baseTaskId].acceptance_status -notin @('VERIFIED', 'INTEGRATED')) {
                Add-Failure "Dispatch-ready task $($task.id) has unaccepted base: $baseTaskId"
            }
        }

        $resolvedBase = $null
        if ([string]$task.base_strategy -eq 'EXACT_COMMIT') {
            $resolvedBase = [string]$task.base_ref
        } elseif ([string]$task.base_strategy -in @('ACCEPTED_BASELINE', 'ACCEPTED_DEPENDENCY_HEAD') -and
            $acceptedById.ContainsKey($baseTaskId)) {
            $resolvedBase = [string]$acceptedById[$baseTaskId].commit
        }
        if ($null -ne $resolvedBase -and $resolvedBase -match '^[0-9a-fA-F]{40}$') {
            foreach ($dependency in @($task.depends_on)) {
                $dependencyCommit = [string]$acceptedById[[string]$dependency].commit
                if (-not (Test-LocalCommit -Commit $dependencyCommit) -or
                    -not (Test-LocalCommit -Commit $resolvedBase)) {
                    Add-Failure "Task $($task.id) base/dependency commit is not locally resolvable; fetch accepted refs"
                    continue
                }
                & git -C $repoRoot merge-base --is-ancestor $dependencyCommit $resolvedBase
                if ($LASTEXITCODE -ne 0) {
                    Add-Failure "Task $($task.id) base does not contain accepted dependency: $dependency"
                }
            }
        }
    }
}

$integration = $registry.integration
if ([string]$registry.control_ref -ne "origin/$([string]$integration.branch)") {
    Add-Failure 'control_ref must point to the configured integration branch'
}
if ($validControlStatuses -notcontains [string]$integration.status) {
    Add-Failure "Integration has unsupported status: $($integration.status)"
}
if ([string]$integration.branch -notmatch '^integration/[A-Za-z0-9._-]+$') {
    Add-Failure "Integration branch is invalid: $($integration.branch)"
}
if (-not $worktrees.Add([string]$integration.worktree)) {
    Add-Failure "Integration worktree duplicates a task worktree: $($integration.worktree)"
}
$integrationPromptPath = Join-Path $repoRoot ([string]$integration.prompt)
if (-not (Test-Path -LiteralPath $integrationPromptPath -PathType Leaf)) {
    Add-Failure "Integration prompt does not exist: $($integration.prompt)"
}

$checkpoint = [string]$integration.current_checkpoint_commit
if ([string]$integration.status -eq 'CONTROL_PLANE_PENDING') {
    if (-not [string]::IsNullOrWhiteSpace($checkpoint)) {
        Add-Failure 'Pending integration control plane must not claim a checkpoint'
    }
} else {
    if ($checkpoint -notmatch '^[0-9a-fA-F]{40}$') {
        Add-Failure 'Active integration control plane requires a full checkpoint commit'
    } elseif (-not (Test-LocalCommit -Commit $checkpoint)) {
        Add-Failure "Integration checkpoint is not locally resolvable: $checkpoint"
    }

    $currentBranch = (& git -C $repoRoot branch --show-current).Trim()
    $currentHead = (& git -C $repoRoot rev-parse HEAD).Trim().ToLowerInvariant()
    $remoteControlHead = Get-RemoteBranchHead -Branch ([string]$integration.branch)
    if ($currentBranch -ne [string]$integration.branch) {
        Add-Failure "Active control files must be validated from $($integration.branch), not $currentBranch"
    }
    if ($null -ne $remoteControlHead -and $currentHead -ne $remoteControlHead) {
        Add-Failure 'Local control HEAD does not match the remote integration control HEAD'
    }
    if ($null -ne $remoteControlHead -and $checkpoint -match '^[0-9a-fA-F]{40}$') {
        & git -C $repoRoot merge-base --is-ancestor $checkpoint $remoteControlHead
        if ($LASTEXITCODE -ne 0) {
            Add-Failure 'Registered checkpoint is not an ancestor of the remote integration control HEAD'
        }
    }
}

foreach ($task in @($registry.tasks)) {
    if ([string]$task.dispatch_status -in @('READY_TO_DISPATCH', 'READY_TO_RESUME') -and
        [string]$task.base_strategy -eq 'INTEGRATION_CHECKPOINT_CONTAINING_ALL_DEPENDENCIES') {
        if ([string]$integration.status -notin @('ACTIVE', 'HARDENING', 'READY_FOR_MAIN')) {
            Add-Failure "Dispatch-ready task $($task.id) requires an active integration control plane"
            continue
        }
        foreach ($dependency in @($task.depends_on)) {
            $acceptedCommit = [string]$acceptedById[[string]$dependency].commit
            & git -C $repoRoot merge-base --is-ancestor $acceptedCommit $checkpoint
            if ($LASTEXITCODE -ne 0) {
                Add-Failure "Integration checkpoint for $($task.id) does not contain $dependency"
            }
        }
    }
}

$tasksByWave = @($registry.tasks | Group-Object wave)
foreach ($waveGroup in $tasksByWave) {
    $lockOwners = @{}
    foreach ($task in @($waveGroup.Group)) {
        foreach ($sharedLock in @($task.shared_locks)) {
            $key = ([string]$sharedLock).ToUpperInvariant()
            if ($lockOwners.ContainsKey($key)) {
                Add-Failure "Wave $($waveGroup.Name) has two owners for lock '$key': $($lockOwners[$key]) and $($task.id)"
            } else {
                $lockOwners[$key] = [string]$task.id
            }
        }
    }
}

foreach ($task in @($registry.tasks)) {
    foreach ($dependency in @($task.depends_on)) {
        $dependencyKey = [string]$dependency
        if ($tasksById.ContainsKey($dependencyKey)) {
            $dependencyTask = $tasksById[$dependencyKey]
            if ([int]$dependencyTask.integration_rank -ge [int]$task.integration_rank) {
                Add-Failure "Task $($task.id) integration_rank must be after dependency $dependencyKey"
            }
            if ([int]$dependencyTask.wave -gt [int]$task.wave) {
                Add-Failure "Task $($task.id) wave is before dependency $dependencyKey"
            }
        }
    }
}

$requiredDocs = @(
    'project-ops/accepted-baselines.json',
    'project-ops/MULTITRACK-BOARD.md',
    'project-ops/plans/P0-MULTITRACK-CLOSED-LOOPS.md',
    'project-ops/runbooks/MULTITRACK-INTEGRATION.md',
    'project-ops/prompts/P0-MULTITRACK-GOAL-MODE-PROMPT.md',
    'project-ops/scripts/resolve-multitrack-task.ps1',
    [string]$registry.template,
    [string]$registry.review_prompt
)
foreach ($relativePath in $requiredDocs) {
    $candidate = Join-Path $repoRoot $relativePath
    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
        Add-Failure "Required multitrack document does not exist: $relativePath"
    }
}

if ($failures.Count -gt 0) {
    foreach ($failure in $failures) {
        Write-Host "[FAIL] $failure" -ForegroundColor Red
    }
    throw "Multitrack plan validation failed with $($failures.Count) issue(s)."
}

Write-Host "[PASS] multitrack_tasks=$(@($registry.tasks).Count) accepted_entries=$(@($accepted.entries).Count) task_prompts=$(@($registry.tasks).Count) remote_heads_verified=1"
