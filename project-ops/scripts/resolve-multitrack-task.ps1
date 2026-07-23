param(
    [Parameter(Mandatory = $true)]
    [string]$TaskId,

    [switch]$CreateWorktree
)

$ErrorActionPreference = 'Stop'
$controlRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$registryPath = Join-Path $controlRoot 'project-ops\multitrack-tasks.json'
$acceptedPath = Join-Path $controlRoot 'project-ops\accepted-baselines.json'

& (Join-Path $PSScriptRoot 'validate-multitrack-plan.ps1')

$registry = Get-Content -LiteralPath $registryPath -Raw -Encoding UTF8 |
    ConvertFrom-Json
$accepted = Get-Content -LiteralPath $acceptedPath -Raw -Encoding UTF8 |
    ConvertFrom-Json
$tasks = @($registry.tasks | Where-Object { [string]$_.id -eq $TaskId })
if ($tasks.Count -ne 1) {
    throw "Task not found or duplicated: $TaskId"
}
$task = $tasks[0]

if ([string]$task.dispatch_status -notin @('READY_TO_DISPATCH', 'READY_TO_RESUME')) {
    throw "Task is not dispatchable: $TaskId ($($task.dispatch_status))"
}

$acceptedById = @{}
foreach ($entry in @($accepted.entries)) {
    $acceptedById[[string]$entry.task_id] = $entry
}
foreach ($dependency in @($task.depends_on)) {
    $dependencyId = [string]$dependency
    if (-not $acceptedById.ContainsKey($dependencyId) -or
        [string]$acceptedById[$dependencyId].acceptance_status -notin @('VERIFIED', 'INTEGRATED')) {
        throw "Dependency is not accepted: $dependencyId"
    }
}

$baseCommit = $null
switch ([string]$task.base_strategy) {
    'EXACT_COMMIT' {
        $baseCommit = [string]$task.base_ref
    }
    'ACCEPTED_BASELINE' {
        $baseTaskId = [string]$task.base_task_id
        if (-not $acceptedById.ContainsKey($baseTaskId) -or
            [string]$acceptedById[$baseTaskId].acceptance_status -notin @('VERIFIED', 'INTEGRATED')) {
            throw "Accepted base is unavailable: $baseTaskId"
        }
        $baseCommit = [string]$acceptedById[$baseTaskId].commit
    }
    'ACCEPTED_DEPENDENCY_HEAD' {
        $baseTaskId = [string]$task.base_task_id
        if (@($task.depends_on) -notcontains $baseTaskId) {
            throw "Dependency base is not declared by task: $baseTaskId"
        }
        if (-not $acceptedById.ContainsKey($baseTaskId) -or
            [string]$acceptedById[$baseTaskId].acceptance_status -notin @('VERIFIED', 'INTEGRATED')) {
            throw "Accepted dependency base is unavailable: $baseTaskId"
        }
        $baseCommit = [string]$acceptedById[$baseTaskId].commit
    }
    'INTEGRATION_CHECKPOINT_CONTAINING_ALL_DEPENDENCIES' {
        if ([string]$registry.integration.status -notin @('ACTIVE', 'HARDENING', 'READY_FOR_MAIN')) {
            throw 'Integration control plane is not active'
        }
        $baseCommit = [string]$registry.integration.current_checkpoint_commit
        $controlHead = (& git -C $controlRoot rev-parse HEAD).Trim()
        & git -C $controlRoot merge-base --is-ancestor $baseCommit $controlHead
        if ($LASTEXITCODE -ne 0) {
            throw 'Registered checkpoint is not an ancestor of the authoritative control HEAD'
        }
        foreach ($dependency in @($task.depends_on)) {
            $acceptedCommit = [string]$acceptedById[[string]$dependency].commit
            & git -C $controlRoot merge-base --is-ancestor $acceptedCommit $baseCommit
            if ($LASTEXITCODE -ne 0) {
                throw "Checkpoint does not contain accepted dependency: $dependency"
            }
        }
    }
    default {
        throw "Unsupported base strategy: $($task.base_strategy)"
    }
}

if ($baseCommit -notmatch '^[0-9a-fA-F]{40}$') {
    throw "Resolved base is not a full commit: $baseCommit"
}
& git -C $controlRoot cat-file -e "$baseCommit^{commit}"
if ($LASTEXITCODE -ne 0) {
    throw "Resolved base is not available locally; fetch the accepted/control refs: $baseCommit"
}

$worktreeRecords = @(& git -C $controlRoot worktree list --porcelain)
$canonicalLine = @($worktreeRecords | Where-Object { $_ -like 'worktree *' }) |
    Select-Object -First 1
if ($null -eq $canonicalLine) {
    throw 'Unable to discover canonical worktree'
}
$canonicalRoot = ([string]$canonicalLine).Substring('worktree '.Length)
$worktreeLeaf = Split-Path -Leaf ([string]$task.worktree)
$workspaceRoot = Split-Path -Parent $canonicalRoot
$targetPath = Join-Path (Join-Path $workspaceRoot 'worktrees') $worktreeLeaf

if ($CreateWorktree) {
    if (Test-Path -LiteralPath $targetPath) {
        $existingBranch = (& git -C $targetPath branch --show-current).Trim()
        if ($existingBranch -ne [string]$task.branch) {
            throw "Existing worktree uses unexpected branch: $targetPath ($existingBranch)"
        }
        Write-Host "[RESUME] $targetPath"
    } else {
        $newWorktreeScript = Join-Path $canonicalRoot 'scripts\repo\new-worktree.ps1'
        & $newWorktreeScript `
            -TaskId $worktreeLeaf `
            -Branch ([string]$task.branch) `
            -BaseRef $baseCommit
    }
}

[pscustomobject]@{
    task_id = [string]$task.id
    dispatch_status = [string]$task.dispatch_status
    branch = [string]$task.branch
    worktree = $targetPath
    base_strategy = [string]$task.base_strategy
    base_commit = $baseCommit.ToLowerInvariant()
    task_file = [string]$task.task_file
    prompt = [string]$task.prompt
}
