param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]+$')]
    [string]$TaskId,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^(task|hotfix)/[A-Za-z0-9._-]+$')]
    [string]$Branch,

    [string]$BaseRef = 'HEAD'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$workspaceRoot = Split-Path -Parent $repoRoot
$worktreesRoot = Join-Path $workspaceRoot 'worktrees'
$target = Join-Path $worktreesRoot $TaskId

if ((git -C $repoRoot rev-parse --show-toplevel).Trim() -ne $repoRoot.Replace('\', '/')) {
    throw "Unexpected canonical repository root: $repoRoot"
}

New-Item -ItemType Directory -Force -Path $worktreesRoot | Out-Null
if (Test-Path -LiteralPath $target) {
    throw "Worktree target already exists: $target"
}

git -C $repoRoot rev-parse --verify "$BaseRef^{commit}" | Out-Null
git -C $repoRoot show-ref --verify --quiet "refs/heads/$Branch"
if ($LASTEXITCODE -eq 0) {
    git -C $repoRoot worktree add $target $Branch
} else {
    git -C $repoRoot worktree add -b $Branch $target $BaseRef
}

if ($LASTEXITCODE -ne 0) {
    throw "git worktree add failed for $TaskId"
}

Write-Output "Worktree created: $target"
Write-Output "Branch: $Branch"
Write-Output "Base: $(git -C $target rev-parse HEAD)"
