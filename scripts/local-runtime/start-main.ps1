[CmdletBinding()]
param(
    [switch]$SkipDocker,
    [switch]$SkipGenerate
)

$ErrorActionPreference = 'Stop'
$rootDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$targetFile = Join-Path $rootDir 'project-ops\runtime-target.json'

if (-not (Test-Path -LiteralPath $targetFile)) {
    throw "Runtime target is missing: $targetFile"
}

$target = Get-Content -LiteralPath $targetFile -Raw -Encoding UTF8 | ConvertFrom-Json
$expectedRoot = [System.IO.Path]::GetFullPath($target.canonical_root)
if (-not $rootDir.Equals($expectedRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to start from a worktree. Start only from canonical root: $expectedRoot"
}

Push-Location $rootDir
try {
    fnm env --shell powershell | Invoke-Expression

    $branch = (git branch --show-current).Trim()
    if ($branch -ne $target.runtime_branch) {
        throw "Runtime branch must be '$($target.runtime_branch)'; current branch is '$branch'. Run promote-integration.ps1 or switch the canonical root back to main."
    }
    if (git status --porcelain) {
        throw 'Canonical root is dirty. Commit/stash the intended work before starting the shared runtime.'
    }

    git fetch origin $target.runtime_branch --quiet
    $localHead = (git rev-parse HEAD).Trim()
    $remoteHead = (git rev-parse "origin/$($target.runtime_branch)").Trim()
    if ($localHead -ne $remoteHead) {
        throw "Canonical main is not the pushed latest baseline. Run: git pull --ff-only origin $($target.runtime_branch)"
    }

    & (Join-Path $rootDir 'scripts\local-runtime\start-core.ps1') -SkipDocker:$SkipDocker -SkipGenerate:$SkipGenerate
} finally {
    Pop-Location
}
