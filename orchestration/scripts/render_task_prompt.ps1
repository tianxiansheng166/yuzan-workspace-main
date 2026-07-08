[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$TaskId,
  [string]$WorkspaceRoot,
  [string]$OutputPath
)

. (Join-Path $PSScriptRoot 'Resolve-YuzanWorkspace.ps1')
$Root = Resolve-YuzanWorkspace -WorkspaceRoot $WorkspaceRoot
$Repo = Join-Path $Root 'yuzan-next'
$TaskId = $TaskId.ToUpperInvariant()
$TaskPath = Join-Path $Root "orchestration/tasks/$TaskId.json"
if (-not (Test-Path $TaskPath)) { throw "未知任务：$TaskId" }
$task = Get-Content -LiteralPath $TaskPath -Raw -Encoding UTF8 | ConvertFrom-Json
$Worktree = [System.IO.Path]::GetFullPath((Join-Path $Repo $task.worktree))

$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add('你正在参与“语赞心声 yuzan-next”多 AI 并发开发。')
$lines.Add('')
$lines.Add("中央工作区：$Root")
$lines.Add("代码工作目录：$Worktree")
$lines.Add("主仓库（只读，不得直接修改）：$Repo")
$lines.Add('')
$lines.Add("任务：$($task.id) — $($task.title)")
$lines.Add("推荐角色：$($task.recommended_role)")
$lines.Add("任务状态：$($task.status)")
$lines.Add("目标分支：$($task.branch)")
$deps = @($task.depends_on) | Where-Object { $_ }
$lines.Add("依赖：$(if ($deps.Count) { $deps -join ', ' } else { '无' })")
$lines.Add('')
$lines.Add('开始时必须先执行并记录输出：')
$lines.Add('```powershell')
$lines.Add("Set-Location -LiteralPath '$Worktree'")
$lines.Add('git status --short')
$lines.Add('git branch --show-current')
$lines.Add('git log -1 --oneline')
$lines.Add('node --version')
$lines.Add('pnpm --version')
$lines.Add('```')
$lines.Add('如果目录、分支或依赖不正确，立即停止，不得在错误目录继续。')
$lines.Add('')
$lines.Add('目标：')
$lines.Add([string]$task.objective)
$lines.Add('')
$lines.Add('只允许修改以下路径：')
foreach ($p in @($task.allowed_paths)) { $lines.Add("- $p") }
$lines.Add('')
$lines.Add('验收条件：')
foreach ($a in @($task.acceptance_criteria)) { $lines.Add("- $a") }
$lines.Add('')
$lines.Add('开始前必须阅读：')
foreach ($p in @($task.required_reading)) { $lines.Add("- $p") }
$lines.Add('')
$lines.Add('执行规则：')
$lines.Add('- 只在当前 worktree 中工作，不得直接修改 main。')
$lines.Add('- 不修改白名单外文件；发现白名单不足时停止并提出变更申请。')
$lines.Add('- 不私自改变共享 OpenAPI、Prisma、设计 token、根配置和错误码。')
$lines.Add('- 不使用硬编码假数据冒充真实功能完成。')
$lines.Add('- 功能必须覆盖权限、异常、失败恢复和测试。')
$lines.Add('- 前端任务必须覆盖 loading、empty、error、offline、permission，并检查 1440/1024/390。')
$lines.Add('- 不得提交 .env、密钥、真实个人信息、生成缓存和无关格式化。')
$lines.Add('')
$lines.Add('工作顺序：')
$lines.Add('1. 阅读要求文件并检查当前代码。')
$lines.Add('2. 先输出实施计划、文件影响范围、潜在契约冲突。')
$lines.Add('3. 再实施最小闭环。')
$lines.Add('4. 运行真实测试、lint、typecheck、build 或任务指定检查。')
$lines.Add('5. 自查 git diff，确保没有越界文件。')
$lines.Add('6. 提交一个清晰 commit。')
$lines.Add('7. 按 handoff 模板输出交接。')
$lines.Add('')
$lines.Add('完成时必须提供：')
$lines.Add('- 修改文件清单及用途；')
$lines.Add('- commit hash；')
$lines.Add('- 实际执行命令及真实结果；')
$lines.Add('- 未通过项目和原因；')
$lines.Add('- 契约/数据库/共享配置是否变化；')
$lines.Add('- 安全、隐私、无障碍和性能风险；')
$lines.Add('- 回滚方法；')
$lines.Add('- 已知限制。')
$lines.Add('')
$lines.Add('现在先执行开始检查并输出计划，不要立即大规模改动。')

$text = $lines -join [Environment]::NewLine
if ($OutputPath) {
  $parent = Split-Path -Parent $OutputPath
  if ($parent) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  Set-Content -LiteralPath $OutputPath -Value $text -Encoding UTF8
  Write-Host "已生成：$OutputPath" -ForegroundColor Green
} else {
  $text
}
