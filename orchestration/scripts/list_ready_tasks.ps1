[CmdletBinding()]
param([string]$WorkspaceRoot)

. (Join-Path $PSScriptRoot 'Resolve-YuzanWorkspace.ps1')
$Root = Resolve-YuzanWorkspace -WorkspaceRoot $WorkspaceRoot
$BoardPath = Join-Path $Root 'orchestration/task-board.csv'
$rows = Import-Csv -LiteralPath $BoardPath -Encoding UTF8
$ready = @($rows | Where-Object { $_.status -eq 'READY' })

if ($ready.Count -eq 0) {
  Write-Host '当前没有 READY 任务。'
  exit 0
}

foreach ($row in $ready) {
  Write-Host "$($row.id)：$($row.title)" -ForegroundColor Cyan
  Write-Host "  推荐角色：$($row.recommended_role)"
  Write-Host "  分支：$($row.branch)"
  Write-Host "  允许路径：$($row.allowed_paths)"
}
