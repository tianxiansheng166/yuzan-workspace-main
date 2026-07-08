param(
  [Parameter(Mandatory=$true)][string]$TaskId,
  [string]$Repo = (Get-Location).Path
)
$TaskFile = Join-Path (Split-Path $PSScriptRoot -Parent) "tasks\$TaskId.json"
if (-not (Test-Path $TaskFile)) { throw "Unknown task: $TaskId" }
$Task = Get-Content $TaskFile -Raw -Encoding UTF8 | ConvertFrom-Json
git -C $Repo worktree add -b $Task.branch $Task.worktree main
Write-Host "Created $($Task.worktree) on $($Task.branch)"
