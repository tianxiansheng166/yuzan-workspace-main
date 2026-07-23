$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$failures = [System.Collections.Generic.List[string]]::new()

function Add-Failure {
    param([string]$Message)
    $failures.Add($Message)
}

function Assert-Contains {
    param(
        [string]$Content,
        [string]$Pattern,
        [string]$Label
    )

    if (-not $Content.Contains($Pattern)) {
        Add-Failure "$Label is missing: $Pattern"
    }
}

$requiredFiles = @(
    'scripts/repo/task-context.ps1',
    'project-ops/plans/P0-STUDENT-CLOSED-LOOPS.md',
    'project-ops/prompts/P0-STUDENT-GOAL-MODE-PROMPT.md',
    'project-ops/tasks/active/P0-STUDENT-GOAL-PLAN-001.json'
)
foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $relativePath) -PathType Leaf)) {
        Add-Failure "Missing task package file: $relativePath"
    }
}

foreach ($scriptName in @('task-context.ps1', 'test-task-context.ps1')) {
    $scriptPath = Join-Path $PSScriptRoot $scriptName
    $bytes = [System.IO.File]::ReadAllBytes($scriptPath)
    foreach ($value in $bytes) {
        if ($value -gt 127) {
            Add-Failure "Governance script must remain ASCII-only for Windows PowerShell 5.1: $scriptName"
            break
        }
    }
}

$taskFile = Join-Path $repoRoot 'project-ops\tasks\active\P0-STUDENT-GOAL-PLAN-001.json'
$task = Get-Content -LiteralPath $taskFile -Raw -Encoding UTF8 | ConvertFrom-Json
if ([string]$task.branch -ne 'task/p0-student-goal-plan-001') {
    Add-Failure "Unexpected task branch: $($task.branch)"
}
if (@($task.context.required).Count -gt 6) {
    Add-Failure 'Task context.required exceeds the six-file budget.'
}

if (Test-Path -LiteralPath (Join-Path $repoRoot 'scripts\repo\task-context.ps1')) {
    $contextScript = Join-Path $repoRoot 'scripts\repo\task-context.ps1'
    $contextOutput = @(& $contextScript -Mode auto 2>&1)
    $contextText = $contextOutput -join [Environment]::NewLine
    foreach ($pattern in @(
        '# AI TASK CONTEXT',
        'effective_mode: resume',
        'task_id: P0-STUDENT-GOAL-PLAN-001',
        'project-ops/AI-DEVELOPMENT-CONTRACT.md',
        'docs/10-project-review/01-',
        '## LIVE GIT STATE',
        'Do not ask the user to attach these files again.'
    )) {
        Assert-Contains -Content $contextText -Pattern $pattern -Label 'task-context output'
    }

    $budgetBlocked = $false
    try {
        & $contextScript -Mode resume -MaxTotalBytes 4096 2>&1 | Out-Null
    } catch {
        if ($_.Exception.Message.Contains('exceeds MaxTotalBytes')) {
            $budgetBlocked = $true
        } else {
            Add-Failure "Unexpected context budget error: $($_.Exception.Message)"
        }
    }
    if (-not $budgetBlocked) {
        Add-Failure 'task-context did not enforce the total byte budget.'
    }
}

$planPath = Join-Path $repoRoot 'project-ops\plans\P0-STUDENT-CLOSED-LOOPS.md'
if (Test-Path -LiteralPath $planPath -PathType Leaf) {
    $plan = Get-Content -LiteralPath $planPath -Raw -Encoding UTF8
    foreach ($pattern in @(
        'P0-STUDENT-COURSE-PRACTICE-001',
        'practiceDefinitionId',
        'submissionId',
        'activityId',
        'UnavailableTranslationRepository',
        'NEEDS_REVIEW',
        'git status --porcelain',
        'task-context.ps1 -Mode auto'
    )) {
        Assert-Contains -Content $plan -Pattern $pattern -Label 'student closed-loop plan'
    }
}

$promptPath = Join-Path $repoRoot 'project-ops\prompts\P0-STUDENT-GOAL-MODE-PROMPT.md'
if (Test-Path -LiteralPath $promptPath -PathType Leaf) {
    $prompt = Get-Content -LiteralPath $promptPath -Raw -Encoding UTF8
    foreach ($pattern in @(
        'task-context.ps1 -Mode auto',
        'P0-STUDENT-COURSE-PRACTICE-001',
        'demo=1',
        'git status --porcelain',
        'git push',
        'READY_FOR_REVIEW'
    )) {
        Assert-Contains -Content $prompt -Pattern $pattern -Label 'Goal Mode prompt'
    }
}

if ($failures.Count -gt 0) {
    foreach ($failure in $failures) {
        Write-Host "[FAIL] $failure" -ForegroundColor Red
    }
    throw "Task context smoke failed with $($failures.Count) issue(s)."
}

Write-Host "[PASS] task context discovery, context budget, Goal Mode prompt, and student plan anchors"
