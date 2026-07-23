param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('preflight', 'review', 'finish')]
    [string]$Mode,

    [Parameter(Mandatory = $true)]
    [string]$TaskFile
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$script:failures = [System.Collections.Generic.List[string]]::new()

function Add-Failure {
    param([string]$Message)
    $script:failures.Add($Message)
}

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$GitArguments,
        [switch]$AllowFailure
    )

    $output = @(& git -C $repoRoot @GitArguments 2>&1)
    $exitCode = $LASTEXITCODE
    if (-not $AllowFailure -and $exitCode -ne 0) {
        throw "git $($GitArguments -join ' ') failed:`n$($output -join [Environment]::NewLine)"
    }

    [pscustomobject]@{
        ExitCode = $exitCode
        Output = $output
    }
}

function Test-NonEmptyProperty {
    param(
        [object]$InputObject,
        [string]$Name
    )

    if ($null -eq $InputObject -or
        -not ($InputObject.PSObject.Properties.Name -contains $Name)) {
        return $false
    }

    $value = $InputObject.$Name
    if ($null -eq $value) {
        return $false
    }

    if ($value -is [string]) {
        return -not [string]::IsNullOrWhiteSpace($value)
    }

    return $true
}

function Test-PathPattern {
    param(
        [string]$Path,
        [string]$Pattern
    )

    $normalizedPath = $Path.Replace('\', '/')
    $normalizedPattern = $Pattern.Replace('\', '/')
    if ($normalizedPattern.EndsWith('/**')) {
        $prefix = $normalizedPattern.Substring(0, $normalizedPattern.Length - 3).TrimEnd('/')
        return $normalizedPath.Equals($prefix, [StringComparison]::OrdinalIgnoreCase) -or
            $normalizedPath.StartsWith("$prefix/", [StringComparison]::OrdinalIgnoreCase)
    }

    $wildcard = [WildcardPattern]::new(
        $normalizedPattern,
        [System.Management.Automation.WildcardOptions]::IgnoreCase
    )
    return $wildcard.IsMatch($normalizedPath)
}

function Test-InsideRepo {
    param([string]$Candidate)

    $fullCandidate = [System.IO.Path]::GetFullPath($Candidate)
    $rootWithSeparator = $repoRoot.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    return $fullCandidate.Equals($repoRoot, [StringComparison]::OrdinalIgnoreCase) -or
        $fullCandidate.StartsWith($rootWithSeparator, [StringComparison]::OrdinalIgnoreCase)
}

$taskCandidate = if ([System.IO.Path]::IsPathRooted($TaskFile)) {
    $TaskFile
} else {
    Join-Path $repoRoot $TaskFile
}

if (-not (Test-Path -LiteralPath $taskCandidate -PathType Leaf)) {
    throw "Task file does not exist: $taskCandidate"
}

$resolvedTaskFile = (Resolve-Path -LiteralPath $taskCandidate).Path
if (-not (Test-InsideRepo -Candidate $resolvedTaskFile)) {
    throw "Task file must be inside this repository: $resolvedTaskFile"
}

try {
    $task = Get-Content -LiteralPath $resolvedTaskFile -Raw -Encoding UTF8 | ConvertFrom-Json
} catch {
    throw "Task JSON is invalid: $($_.Exception.Message)"
}

$actualRootResult = Invoke-Git -GitArguments @('rev-parse', '--show-toplevel')
$actualRoot = [System.IO.Path]::GetFullPath(($actualRootResult.Output | Select-Object -First 1))
if (-not $actualRoot.Equals($repoRoot, [StringComparison]::OrdinalIgnoreCase)) {
    Add-Failure "Unexpected Git root: $actualRoot (expected $repoRoot)"
}

$requiredFields = @(
    'id',
    'status',
    'title',
    'owner',
    'reviewer',
    'branch',
    'base_commit',
    'user_outcome',
    'current_facts',
    'product_alignment',
    'context',
    'depends_on',
    'integration_order',
    'allowed_paths',
    'shared_owner_changes',
    'minimal_tests',
    'test_evidence',
    'handoff',
    'rollback',
    'delivery'
)
foreach ($field in $requiredFields) {
    if (-not (Test-NonEmptyProperty -InputObject $task -Name $field)) {
        Add-Failure "Task field '$field' is required."
    }
}

$allowedStatuses = @('PLANNED', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'COMPLETED', 'BLOCKED')
if ($allowedStatuses -notcontains [string]$task.status) {
    Add-Failure "Task status '$($task.status)' is not supported."
}
if ([string]$task.branch -notmatch '^(task|hotfix)/[A-Za-z0-9._-]+$') {
    Add-Failure "Task branch has an unsupported format: $($task.branch)"
}
if ([string]$task.base_commit -notmatch '^[0-9a-fA-F]{40}$') {
    Add-Failure 'Task base_commit must be a full 40-character commit hash.'
}

foreach ($field in @('p0', 'contribution', 'non_goals')) {
    if (-not (Test-NonEmptyProperty -InputObject $task.product_alignment -Name $field)) {
        Add-Failure "Task product_alignment.$field is required."
    }
}
if (@($task.current_facts).Count -eq 0) {
    Add-Failure 'Task current_facts must not be empty.'
}
if (@($task.product_alignment.non_goals).Count -eq 0) {
    Add-Failure 'Task product_alignment.non_goals must not be empty.'
}

if (-not (Test-NonEmptyProperty -InputObject $task.context -Name 'required')) {
    Add-Failure 'Task context.required is required.'
}
if (@($task.context.required).Count -eq 0) {
    Add-Failure 'Task context.required must not be empty.'
}
if (@($task.context.required).Count -gt 6) {
    Add-Failure 'Task context.required exceeds the six-file context budget; split or narrow the task.'
}
if (@($task.integration_order).Count -eq 0) {
    Add-Failure 'Task integration_order must not be empty.'
}
foreach ($field in @('push_task_branch', 'remote', 'merge_target')) {
    if (-not (Test-NonEmptyProperty -InputObject $task.delivery -Name $field)) {
        Add-Failure "Task delivery.$field is required."
    }
}

$allowedPaths = @($task.allowed_paths)
if ($allowedPaths.Count -eq 0) {
    Add-Failure 'Task allowed_paths must not be empty.'
}

$minimalTests = @($task.minimal_tests)
if ($minimalTests.Count -eq 0) {
    Add-Failure 'Task minimal_tests must not be empty.'
}
foreach ($test in $minimalTests) {
    if (-not (Test-NonEmptyProperty -InputObject $test -Name 'name') -or
        -not (Test-NonEmptyProperty -InputObject $test -Name 'command')) {
        Add-Failure 'Each minimal_tests entry needs name and command.'
    }
}

$branchResult = Invoke-Git -GitArguments @('branch', '--show-current')
$actualBranch = [string]($branchResult.Output | Select-Object -First 1)
if ($actualBranch -ne [string]$task.branch) {
    Add-Failure "Branch mismatch: '$actualBranch' (expected '$($task.branch)')."
}

$baseResult = Invoke-Git -GitArguments @('rev-parse', '--verify', "$($task.base_commit)^{commit}") -AllowFailure
if ($baseResult.ExitCode -ne 0) {
    Add-Failure "Base commit does not resolve: $($task.base_commit)"
} else {
    $ancestorResult = Invoke-Git -GitArguments @(
        'merge-base',
        '--is-ancestor',
        [string]$task.base_commit,
        'HEAD'
    ) -AllowFailure
    if ($ancestorResult.ExitCode -ne 0) {
        Add-Failure "Base commit is not an ancestor of HEAD: $($task.base_commit)"
    }
}

$changedPaths = [System.Collections.Generic.HashSet[string]]::new(
    [StringComparer]::OrdinalIgnoreCase
)
$changeCommands = @(
    @('diff', '--name-only', "$($task.base_commit)...HEAD", '--'),
    @('diff', '--name-only', '--'),
    @('diff', '--cached', '--name-only', '--'),
    @('ls-files', '--others', '--exclude-standard')
)
foreach ($command in $changeCommands) {
    $result = Invoke-Git -GitArguments $command
    foreach ($path in $result.Output) {
        if (-not [string]::IsNullOrWhiteSpace([string]$path)) {
            [void]$changedPaths.Add(([string]$path).Replace('\', '/'))
        }
    }
}

foreach ($path in $changedPaths) {
    $isAllowed = $false
    foreach ($pattern in $allowedPaths) {
        if (Test-PathPattern -Path $path -Pattern ([string]$pattern)) {
            $isAllowed = $true
            break
        }
    }
    if (-not $isAllowed) {
        Add-Failure "Changed path is outside allowed_paths: $path"
    }
}

$sharedPatterns = @(
    '.github/**',
    'AGENTS.md',
    'README-FIRST.md',
    'package.json',
    'pnpm-workspace.yaml',
    'pnpm-lock.yaml',
    'packages/contracts/**',
    'infra/database/**',
    'project-ops/AI-DEVELOPMENT-CONTRACT.md',
    'project-ops/CONTEXT-ROUTER.md',
    'project-ops/DEVELOPMENT-WORKFLOW.md',
    'scripts/repo/**'
)
$sharedChanged = $false
foreach ($path in $changedPaths) {
    foreach ($pattern in $sharedPatterns) {
        if (Test-PathPattern -Path $path -Pattern $pattern) {
            $sharedChanged = $true
        }
    }
}
if ($sharedChanged -and @($task.shared_owner_changes).Count -eq 0) {
    Add-Failure 'Shared files changed but shared_owner_changes is empty.'
}

$contractPatterns = @('packages/contracts/**', 'infra/database/**')
$contractChanged = $false
foreach ($path in $changedPaths) {
    foreach ($pattern in $contractPatterns) {
        if (Test-PathPattern -Path $path -Pattern $pattern) {
            $contractChanged = $true
        }
    }
}
if ($contractChanged) {
    if (-not (Test-NonEmptyProperty -InputObject $task -Name 'contract_change_request')) {
        Add-Failure 'OpenAPI/contracts/database changes require contract_change_request.'
    } else {
        $ccrPath = Join-Path $repoRoot ([string]$task.contract_change_request)
        if (-not (Test-InsideRepo -Candidate $ccrPath) -or
            -not (Test-Path -LiteralPath $ccrPath -PathType Leaf)) {
            Add-Failure "Contract change request does not exist: $($task.contract_change_request)"
        }
    }
}

if ($Mode -eq 'preflight') {
    $dirty = @(Invoke-Git -GitArguments @('status', '--porcelain=v1')).Output
    if ($dirty.Count -gt 0) {
        Add-Failure 'Preflight requires a clean worktree after the task metadata checkpoint.'
    }
    if (@('PLANNED', 'IN_PROGRESS') -notcontains [string]$task.status) {
        Add-Failure 'Preflight requires task status PLANNED or IN_PROGRESS.'
    }
}

if ($Mode -in @('review', 'finish')) {
    if (@('READY_FOR_REVIEW', 'COMPLETED') -notcontains [string]$task.status) {
        Add-Failure 'Review/finish requires task status READY_FOR_REVIEW or COMPLETED.'
    }

    foreach ($contextPath in @($task.context.required)) {
        $candidate = Join-Path $repoRoot ([string]$contextPath)
        if (-not (Test-InsideRepo -Candidate $candidate) -or
            -not (Test-Path -LiteralPath $candidate)) {
            Add-Failure "Required context path does not exist: $contextPath"
        }
    }

    $handoffPath = Join-Path $repoRoot ([string]$task.handoff)
    if (-not (Test-InsideRepo -Candidate $handoffPath) -or
        -not (Test-Path -LiteralPath $handoffPath -PathType Leaf)) {
        Add-Failure "Handoff does not exist: $($task.handoff)"
    }

    $evidence = @($task.test_evidence)
    foreach ($test in $minimalTests) {
        $matches = @($evidence | Where-Object { $_.name -eq $test.name })
        if ($matches.Count -eq 0) {
            Add-Failure "Missing test_evidence for: $($test.name)"
            continue
        }
        if ([string]$matches[0].result -ne 'PASS') {
            Add-Failure "Test evidence is not PASS: $($test.name)"
        }
        if (-not (Test-NonEmptyProperty -InputObject $matches[0] -Name 'command') -or
            -not (Test-NonEmptyProperty -InputObject $matches[0] -Name 'summary')) {
            Add-Failure "Test evidence needs command and summary: $($test.name)"
        }
    }

    $diffChecks = @(
        @('diff', '--check', "$($task.base_commit)...HEAD", '--'),
        @('diff', '--check', '--'),
        @('diff', '--cached', '--check', '--')
    )
    foreach ($command in $diffChecks) {
        $result = Invoke-Git -GitArguments $command -AllowFailure
        if ($result.ExitCode -ne 0) {
            Add-Failure "Git whitespace check failed: git $($command -join ' ')"
        }
    }
}

if ($Mode -eq 'finish') {
    $aheadResult = Invoke-Git -GitArguments @(
        'rev-list',
        '--count',
        "$($task.base_commit)..HEAD"
    )
    $aheadCount = [int]($aheadResult.Output | Select-Object -First 1)
    if ($aheadCount -lt 1) {
        Add-Failure 'Task branch has no commits ahead of base_commit.'
    }

    $dirty = @(Invoke-Git -GitArguments @('status', '--porcelain=v1')).Output
    if ($dirty.Count -gt 0) {
        Add-Failure 'Finish requires git status --porcelain to be empty.'
    }
}

if ($script:failures.Count -gt 0) {
    foreach ($failure in $script:failures) {
        Write-Host "[FAIL] $failure" -ForegroundColor Red
    }
    throw "Task gate '$Mode' failed with $($script:failures.Count) issue(s)."
}

Write-Host "[PASS] task=$($task.id) mode=$Mode branch=$actualBranch changed_paths=$($changedPaths.Count)"
