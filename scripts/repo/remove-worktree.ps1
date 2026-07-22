param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]+$')]
    [string]$TaskId
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$workspaceRoot = Split-Path -Parent $repoRoot
$worktreesRoot = Join-Path $workspaceRoot 'worktrees'
$target = Join-Path $worktreesRoot $TaskId

if (-not (Test-Path -LiteralPath $target)) {
    throw "Worktree does not exist: $target"
}

$resolvedTarget = (Resolve-Path -LiteralPath $target).Path
$resolvedWorktrees = (Resolve-Path -LiteralPath $worktreesRoot).Path
if ((Split-Path -Parent $resolvedTarget) -ne $resolvedWorktrees) {
    throw "Refusing to remove path outside the worktree root: $resolvedTarget"
}

$dirty = @(git -C $target status --porcelain)
if ($dirty.Count -gt 0) {
    throw "Worktree has uncommitted changes and was not removed: $target"
}

git -C $repoRoot worktree remove $target
if ($LASTEXITCODE -ne 0) {
    throw "git worktree remove failed for $target"
}

Write-Output "Removed clean worktree: $target"
