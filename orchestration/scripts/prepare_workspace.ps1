[CmdletBinding()]
param(
  [string]$WorkspaceRoot,
  [switch]$SkipInstall
)

. (Join-Path $PSScriptRoot 'Resolve-YuzanWorkspace.ps1')
$Root = Resolve-YuzanWorkspace -WorkspaceRoot $WorkspaceRoot
$Repo = Join-Path $Root 'yuzan-next'
$ReportDir = Join-Path $Root 'runtime-reports'
New-Item -ItemType Directory -Path $ReportDir -Force | Out-Null
$ReportPath = Join-Path $ReportDir 'environment-preparation.txt'
$log = [System.Collections.Generic.List[string]]::new()
function Log([string]$Text) { $log.Add("[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Text"); Write-Host $Text }
function Require-Command([string]$Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) { throw "缺少命令：$Name" }
  return $cmd
}

Log "工作区：$Root"
Log "仓库：$Repo"
Require-Command git | Out-Null
Require-Command node | Out-Null
Require-Command npm | Out-Null
Require-Command docker | Out-Null

$nodeVersionText = (& node --version).Trim()
$nodeMajor = [int](($nodeVersionText -replace '^v','').Split('.')[0])
Log "Node：$nodeVersionText"
if ($nodeMajor -lt 24 -or $nodeMajor -ge 27) { throw "Node 版本不满足 package.json：需要 >=24 <27，当前 $nodeVersionText" }

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  if ($SkipInstall) { throw '未找到 pnpm，且指定了 SkipInstall。' }
  Log '未找到 pnpm，正在通过 npm 安装 pnpm@10.13.1...'
  & npm install --global pnpm@10.13.1
  if ($LASTEXITCODE -ne 0) { throw 'pnpm 安装失败。' }
}
$pnpmVersion = (& pnpm --version).Trim()
Log "pnpm：$pnpmVersion"
if (-not $pnpmVersion.StartsWith('10.')) { throw "需要 pnpm 10.x，当前 $pnpmVersion" }

& docker version *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker 命令不可用或 Docker Desktop 未启动。' }
Log "Docker：$((& docker --version).Trim())"
Log "Docker Compose：$((& docker compose version).Trim())"

# 将治理资料放入 Git 仓库，使每个 worktree 都能读取同一基线。
$copyDirs = @('docs','design-lab','orchestration','source-materials')
foreach ($dir in $copyDirs) {
  $src = Join-Path $Root $dir
  $dst = Join-Path $Repo $dir
  if (Test-Path $src) {
    Log "同步 $dir 到仓库"
    Copy-Item -LiteralPath $src -Destination $dst -Recurse -Force
  }
}
foreach ($file in @('README-FIRST.md','START-HERE-CHECKLIST.md','SETUP-WITH-LEGACY.md','PACKAGE-VALIDATION.md','CHANGELOG.md')) {
  $src = Join-Path $Root $file
  if (Test-Path $src) { Copy-Item -LiteralPath $src -Destination (Join-Path $Repo $file) -Force }
}

# 旧源代码归档留在中央工作区，仓库只记录清单和迁移输出目录，避免每个 worktree 重复检出大压缩包。
$repoLegacy = Join-Path $Repo 'legacy'
New-Item -ItemType Directory -Path $repoLegacy -Force | Out-Null
foreach ($dir in @('exports','review','reports','manifests','source-archives')) {
  New-Item -ItemType Directory -Path (Join-Path $repoLegacy $dir) -Force | Out-Null
}
if (Test-Path (Join-Path $Root 'legacy/README.md')) { Copy-Item (Join-Path $Root 'legacy/README.md') $repoLegacy -Force }
if (Test-Path (Join-Path $Root 'legacy/manifests')) { Copy-Item (Join-Path $Root 'legacy/manifests/*') (Join-Path $repoLegacy 'manifests') -Recurse -Force }
$externalArchive = Join-Path $Root 'legacy/source-archives/two-副本.zip'
Set-Content -LiteralPath (Join-Path $repoLegacy 'source-archives/EXTERNAL-SOURCE.txt') -Encoding UTF8 -Value @"
旧项目源压缩包保存在中央工作区，不提交到新项目 Git：
$externalArchive

MIG-001 只能读取该压缩包；输出写入当前仓库的 legacy/exports、legacy/review、legacy/reports。
"@
New-Item -ItemType Directory -Path (Join-Path $Repo 'tools/migration') -Force | Out-Null

if (-not (Test-Path (Join-Path $Repo '.git'))) {
  Log '初始化 Git main 分支'
  & git -C $Repo init -b main
  if ($LASTEXITCODE -ne 0) { throw 'git init 失败。' }
}

$userName = (& git -C $Repo config user.name).Trim()
$userEmail = (& git -C $Repo config user.email).Trim()
if (-not $userName) { & git -C $Repo config user.name 'Local Integration Lead'; Log '已设置仓库本地 Git user.name=Local Integration Lead' }
if (-not $userEmail) { & git -C $Repo config user.email 'local-integration@example.invalid'; Log '已设置仓库本地 Git user.email=local-integration@example.invalid' }

if (-not (Test-Path (Join-Path $Repo '.env'))) {
  Copy-Item (Join-Path $Repo '.env.example') (Join-Path $Repo '.env')
  Log '已从 .env.example 创建本地 .env（不会提交）'
}

if (-not $SkipInstall) {
  Log '执行 pnpm install...'
  & pnpm --dir $Repo install
  if ($LASTEXITCODE -ne 0) { throw 'pnpm install 失败。' }
}

& git -C $Repo add .
& git -C $Repo diff --cached --quiet
$hasStaged = ($LASTEXITCODE -ne 0)
& git -C $Repo rev-parse --verify HEAD *> $null
$hasHead = ($LASTEXITCODE -eq 0)
if ($hasStaged) {
  $message = if ($hasHead) { 'chore: synchronize workspace governance baseline' } else { 'chore: initialize yuzan-next workspace' }
  & git -C $Repo commit -m $message
  if ($LASTEXITCODE -ne 0) { throw '初始提交失败。' }
  Log "已提交：$message"
} elseif (-not $hasHead) {
  throw '仓库没有可提交文件，无法建立 main 基线。'
} else {
  Log '仓库已有提交且没有待提交变更。'
}

& (Join-Path $PSScriptRoot 'validate_task_files.ps1') -WorkspaceRoot $Root
if ($LASTEXITCODE -ne 0) { throw '任务配置验证失败。' }

$log | Set-Content -LiteralPath $ReportPath -Encoding UTF8
Write-Host "环境准备完成。报告：$ReportPath" -ForegroundColor Green
Write-Host "MAIN_COMMIT=$((& git -C $Repo rev-parse HEAD).Trim())"
