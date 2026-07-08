[CmdletBinding()]
param([string]$WorkspaceRoot)

. (Join-Path $PSScriptRoot 'Resolve-YuzanWorkspace.ps1')
$Root = Resolve-YuzanWorkspace -WorkspaceRoot $WorkspaceRoot
$Orchestration = Join-Path $Root 'orchestration'
$BoardPath = Join-Path $Orchestration 'task-board.csv'
$TasksPath = Join-Path $Orchestration 'tasks'

$errors = [System.Collections.Generic.List[string]]::new()
if (-not (Test-Path $BoardPath)) { throw "找不到任务板：$BoardPath" }
if (-not (Test-Path $TasksPath)) { throw "找不到任务目录：$TasksPath" }

$rows = Import-Csv -LiteralPath $BoardPath -Encoding UTF8
$board = @{}
foreach ($row in $rows) {
  if (-not $row.id) { $errors.Add('task-board.csv 存在缺少 id 的行'); continue }
  if ($board.ContainsKey($row.id)) { $errors.Add("任务板重复 ID：$($row.id)") }
  $board[$row.id] = $row
}

$taskIds = @{}
Get-ChildItem -LiteralPath $TasksPath -Filter '*.json' | ForEach-Object {
  try {
    $task = Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
  } catch {
    $errors.Add("$($_.Name)：JSON 无效：$($_.Exception.Message)")
    return
  }

  if (-not $task.id) { $errors.Add("$($_.Name)：缺少 id"); return }
  $taskIds[$task.id] = $true
  if (-not $board.ContainsKey($task.id)) { $errors.Add("$($task.id)：不在 task-board.csv 中") }
  foreach ($dep in @($task.depends_on)) {
    if ($dep -and -not $board.ContainsKey($dep)) { $errors.Add("$($task.id)：未知依赖 $dep") }
  }
  if (@($task.allowed_paths).Count -eq 0) { $errors.Add("$($task.id)：allowed_paths 为空") }
  if (-not $task.branch) { $errors.Add("$($task.id)：缺少 branch") }
  if (-not $task.worktree) { $errors.Add("$($task.id)：缺少 worktree") }
}

foreach ($id in $board.Keys) {
  if (-not $taskIds.ContainsKey($id)) { $errors.Add("$id：缺少任务 JSON") }
}

if ($errors.Count -gt 0) {
  Write-Host '任务配置验证失败：' -ForegroundColor Red
  $errors | ForEach-Object { Write-Host "- $_" -ForegroundColor Red }
  exit 1
}

Write-Host "OK：已验证 $($rows.Count) 条任务记录。" -ForegroundColor Green
