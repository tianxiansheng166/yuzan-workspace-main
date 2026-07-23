param(
    [ValidateSet('auto', 'start', 'resume')]
    [string]$Mode = 'auto',

    [string]$TaskFile,

    [ValidateRange(1024, 1048576)]
    [int]$MaxFileBytes = 102400,

    [ValidateRange(4096, 4194304)]
    [int]$MaxTotalBytes = 204800
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$script:totalContextBytes = 0

function Invoke-GitLines {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$GitArguments
    )

    $output = @(& git -C $repoRoot @GitArguments 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "git $($GitArguments -join ' ') failed:`n$($output -join [Environment]::NewLine)"
    }

    return $output
}

function Test-InsideRepo {
    param([string]$Candidate)

    $fullCandidate = [System.IO.Path]::GetFullPath($Candidate)
    $rootWithSeparator = $repoRoot.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    return $fullCandidate.Equals($repoRoot, [StringComparison]::OrdinalIgnoreCase) -or
        $fullCandidate.StartsWith($rootWithSeparator, [StringComparison]::OrdinalIgnoreCase)
}

function Resolve-RepoFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Candidate,
        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    $fullCandidate = if ([System.IO.Path]::IsPathRooted($Candidate)) {
        [System.IO.Path]::GetFullPath($Candidate)
    } else {
        [System.IO.Path]::GetFullPath((Join-Path $repoRoot $Candidate))
    }

    if (-not (Test-InsideRepo -Candidate $fullCandidate)) {
        throw "$Label must stay inside this repository: $Candidate"
    }
    if (-not (Test-Path -LiteralPath $fullCandidate -PathType Leaf)) {
        throw "$Label does not exist or is not a file: $Candidate"
    }

    return (Resolve-Path -LiteralPath $fullCandidate).Path
}

function Get-RepoRelativePath {
    param([string]$FullPath)

    return $FullPath.Substring($repoRoot.Length).TrimStart('\', '/').Replace('\', '/')
}

function Read-TaskJson {
    param([string]$ResolvedPath)

    try {
        return Get-Content -LiteralPath $ResolvedPath -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch {
        throw "Task JSON is invalid at $ResolvedPath`: $($_.Exception.Message)"
    }
}

function Write-ContextFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RelativeOrAbsolutePath,
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [System.Collections.Generic.HashSet[string]]$EmittedPaths
    )

    $resolvedPath = Resolve-RepoFile -Candidate $RelativeOrAbsolutePath -Label 'Context file'
    $relativePath = Get-RepoRelativePath -FullPath $resolvedPath
    if (-not $EmittedPaths.Add($relativePath)) {
        return
    }

    $fileInfo = Get-Item -LiteralPath $resolvedPath
    if ($fileInfo.Length -gt $MaxFileBytes) {
        throw "Context file exceeds MaxFileBytes ($MaxFileBytes): $relativePath ($($fileInfo.Length) bytes)"
    }
    if (($script:totalContextBytes + $fileInfo.Length) -gt $MaxTotalBytes) {
        throw "Context set exceeds MaxTotalBytes ($MaxTotalBytes) when adding: $relativePath"
    }

    $bytes = [System.IO.File]::ReadAllBytes($resolvedPath)
    if ([Array]::IndexOf($bytes, [byte]0) -ge 0) {
        throw "Binary context is not allowed: $relativePath"
    }
    $script:totalContextBytes += $fileInfo.Length

    Write-Output ""
    Write-Output "===== BEGIN FILE: $relativePath ====="
    Write-Output (Get-Content -LiteralPath $resolvedPath -Raw -Encoding UTF8)
    Write-Output "===== END FILE: $relativePath ====="
}

$actualBranch = [string](@(Invoke-GitLines -GitArguments @('branch', '--show-current')) | Select-Object -First 1)
if ([string]::IsNullOrWhiteSpace($actualBranch)) {
    throw 'A named Git branch is required; detached HEAD is not supported for task execution.'
}

$resolvedTaskFile = $null
$task = $null
if (-not [string]::IsNullOrWhiteSpace($TaskFile)) {
    $resolvedTaskFile = Resolve-RepoFile -Candidate $TaskFile -Label 'Task file'
    $task = Read-TaskJson -ResolvedPath $resolvedTaskFile
} else {
    $activeTasksDir = Join-Path $repoRoot 'project-ops\tasks\active'
    if (-not (Test-Path -LiteralPath $activeTasksDir -PathType Container)) {
        throw "Active task directory does not exist: $activeTasksDir"
    }

    $matches = @()
    foreach ($candidate in @(Get-ChildItem -LiteralPath $activeTasksDir -Filter '*.json' -File)) {
        $candidateTask = Read-TaskJson -ResolvedPath $candidate.FullName
        if ([string]$candidateTask.branch -eq $actualBranch) {
            $matches += [pscustomobject]@{
                Path = $candidate.FullName
                Task = $candidateTask
            }
        }
    }

    if ($matches.Count -eq 0) {
        throw "No active task JSON matches branch '$actualBranch'. Create or assign the task before development."
    }
    if ($matches.Count -gt 1) {
        $paths = @($matches | ForEach-Object { Get-RepoRelativePath -FullPath $_.Path })
        throw "Multiple active task JSON files match branch '$actualBranch': $($paths -join ', ')"
    }

    $resolvedTaskFile = $matches[0].Path
    $task = $matches[0].Task
}

if ([string]$task.branch -ne $actualBranch) {
    throw "Task branch mismatch: current '$actualBranch', task '$($task.branch)'."
}

$effectiveMode = $Mode
if ($Mode -eq 'auto') {
    if ([string]$task.status -eq 'PLANNED') {
        $effectiveMode = 'start'
    } else {
        $effectiveMode = 'resume'
    }
}

$taskGate = Join-Path $PSScriptRoot 'task-gate.ps1'
$gateMode = 'resume'
if ($effectiveMode -eq 'start') {
    $gateMode = 'preflight'
}
& $taskGate -Mode $gateMode -TaskFile $resolvedTaskFile

$head = [string](@(Invoke-GitLines -GitArguments @('rev-parse', 'HEAD')) | Select-Object -First 1)
$taskRelativePath = Get-RepoRelativePath -FullPath $resolvedTaskFile

Write-Output ""
Write-Output '# AI TASK CONTEXT'
Write-Output "effective_mode: $effectiveMode"
Write-Output "repository: $repoRoot"
Write-Output "branch: $actualBranch"
Write-Output "head: $head"
Write-Output "task_file: $taskRelativePath"
Write-Output "task_id: $($task.id)"
Write-Output "task_status: $($task.status)"
Write-Output 'context_policy: stable contract + task JSON + context.required only'
Write-Output "context_byte_budget: $MaxTotalBytes"

$emittedPaths = [System.Collections.Generic.HashSet[string]]::new(
    [StringComparer]::OrdinalIgnoreCase
)
Write-ContextFile -RelativeOrAbsolutePath 'project-ops/AI-DEVELOPMENT-CONTRACT.md' -EmittedPaths $emittedPaths
Write-ContextFile -RelativeOrAbsolutePath $resolvedTaskFile -EmittedPaths $emittedPaths

foreach ($contextPath in @($task.context.required)) {
    Write-ContextFile -RelativeOrAbsolutePath ([string]$contextPath) -EmittedPaths $emittedPaths
}

if ($effectiveMode -eq 'resume' -and
    $null -ne $task.handoff -and
    -not [string]::IsNullOrWhiteSpace([string]$task.handoff)) {
    $handoffCandidate = Join-Path $repoRoot ([string]$task.handoff)
    if ((Test-InsideRepo -Candidate $handoffCandidate) -and
        (Test-Path -LiteralPath $handoffCandidate -PathType Leaf)) {
        Write-ContextFile -RelativeOrAbsolutePath $handoffCandidate -EmittedPaths $emittedPaths
    }
}

Write-Output ""
Write-Output '## LIVE GIT STATE'
foreach ($line in @(Invoke-GitLines -GitArguments @('status', '--short', '--branch'))) {
    Write-Output $line
}

Write-Output ""
Write-Output '## RECENT COMMITS'
foreach ($line in @(Invoke-GitLines -GitArguments @('log', '-5', '--oneline', '--decorate'))) {
    Write-Output $line
}

Write-Output ""
Write-Output '## CHANGED PATHS SINCE TASK BASE'
$changedSinceBase = @(Invoke-GitLines -GitArguments @(
    'diff',
    '--name-status',
    "$($task.base_commit)...HEAD",
    '--'
))
if ($changedSinceBase.Count -eq 0) {
    Write-Output '(none)'
} else {
    foreach ($line in $changedSinceBase) {
        Write-Output $line
    }
}

Write-Output ""
Write-Output '## EXECUTION RULE'
Write-Output 'Treat the emitted files and live Git state as the complete startup context.'
Write-Output 'Do not ask the user to attach these files again.'
Write-Output 'Read optional or additional files only when a concrete unresolved fact requires them.'
Write-Output 'Continue from integration_order, current diffs, test evidence, and handoff; do not restart completed work.'
