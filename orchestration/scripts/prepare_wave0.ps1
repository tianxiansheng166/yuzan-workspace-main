[CmdletBinding()]
param([string]$WorkspaceRoot)

. (Join-Path $PSScriptRoot 'Resolve-YuzanWorkspace.ps1')
$Root = Resolve-YuzanWorkspace -WorkspaceRoot $WorkspaceRoot
$PromptDir = Join-Path $Root 'runtime-prompts/wave0'
$ReportDir = Join-Path $Root 'runtime-reports'
New-Item -ItemType Directory -Path $PromptDir -Force | Out-Null
New-Item -ItemType Directory -Path $ReportDir -Force | Out-Null

$tasks = @('GOV-004','MIG-001','GOV-001','GOV-002','GOV-003')
foreach ($taskId in $tasks) {
  & (Join-Path $PSScriptRoot 'bootstrap_worktree.ps1') -TaskId $taskId -WorkspaceRoot $Root
  if ($LASTEXITCODE -ne 0) { throw "创建 $taskId worktree 失败。" }
  & (Join-Path $PSScriptRoot 'render_task_prompt.ps1') -TaskId $taskId -WorkspaceRoot $Root -OutputPath (Join-Path $PromptDir "$taskId.txt")
  if ($LASTEXITCODE -ne 0) { throw "生成 $taskId 指令失败。" }
}

$summary = @"
Wave 0 已准备完成。

派发顺序：
- Codex-1：GOV-004
- Codex-2：MIG-001
- Trae-1：GOV-001
- Trae-2：GOV-002
- Trae-3：GOV-003

提示词目录：$PromptDir
worktree 根目录：$([System.IO.Path]::GetFullPath((Join-Path (Join-Path $Root 'yuzan-next') '../worktrees')))

请不要派发任何 BLOCKED 任务。
每个 AI 完成后，只收集 handoff、commit hash 和测试输出，不要自行合并。
"@
$summaryPath = Join-Path $ReportDir 'wave0-preparation-summary.txt'
Set-Content -LiteralPath $summaryPath -Value $summary -Encoding UTF8
Write-Host $summary -ForegroundColor Green
Write-Host "摘要：$summaryPath"
