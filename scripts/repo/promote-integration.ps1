[CmdletBinding()]
param(
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'
$rootDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$target = Get-Content -LiteralPath (Join-Path $rootDir 'project-ops\runtime-target.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$expectedRoot = [System.IO.Path]::GetFullPath($target.canonical_root)

if (-not $rootDir.Equals($expectedRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Run promotion only in canonical root: $expectedRoot"
}

Push-Location $rootDir
try {
    $branch = (git branch --show-current).Trim()
    if ($branch -ne $target.runtime_branch) { throw "Canonical root must be on $($target.runtime_branch), not $branch." }
    if (git status --porcelain) { throw 'Canonical root is dirty; promotion is intentionally refused.' }

    git fetch origin $target.runtime_branch $target.integration_branch --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Cannot verify origin refs. Check network/SSH access; promotion is refused.' }
    $mainRef = "origin/$($target.runtime_branch)"
    $candidate = "origin/$($target.integration_branch)"
    git merge-base --is-ancestor $mainRef $candidate
    if ($LASTEXITCODE -ne 0) { throw "$mainRef is not an ancestor of $candidate; do not rewrite history. Resolve on integration first." }

    $mainHead = (git rev-parse $mainRef).Trim()
    $candidateHead = (git rev-parse $candidate).Trim()
    Write-Host "Promotion candidate: $candidateHead"
    Write-Host "Current main:       $mainHead"
    Write-Host 'Required evidence before -Apply: integration handoff/checkpoint, targeted tests, typecheck/build, and no fake-success state.'
    if (-not $Apply) {
        Write-Host 'Dry run only. After the hardening checks pass, run: .\scripts\repo\promote-integration.ps1 -Apply'
        return
    }

    git pull --ff-only origin $target.runtime_branch
    git merge --ff-only $candidate
    git push origin $target.runtime_branch
    Write-Host "Promoted $candidateHead to $($target.runtime_branch). Start it with .\scripts\local-runtime\start-main.ps1"
} finally {
    Pop-Location
}
