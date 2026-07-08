[CmdletBinding()]
param([string]$WorkspaceRoot)

. (Join-Path $PSScriptRoot 'Resolve-YuzanWorkspace.ps1')
$Root = Resolve-YuzanWorkspace -WorkspaceRoot $WorkspaceRoot
$ReportDir = Join-Path $Root 'runtime-reports'
New-Item -ItemType Directory -Path $ReportDir -Force | Out-Null
$Report = Join-Path $ReportDir 'environment-inspection.txt'

$names = @('git','node','npm','pnpm','docker','winget','python','py')
$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add("WorkspaceRoot=$Root")
$lines.Add("PowerShell=$($PSVersionTable.PSVersion)")
foreach ($name in $names) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if (-not $cmd) { $lines.Add("$name=MISSING"); continue }
  try {
    $version = switch ($name) {
      'git' { (& git --version) -join ' ' }
      'node' { (& node --version) -join ' ' }
      'npm' { (& npm --version) -join ' ' }
      'pnpm' { (& pnpm --version) -join ' ' }
      'docker' { (& docker --version) -join ' ' }
      'winget' { (& winget --version) -join ' ' }
      'python' { (& python --version 2>&1) -join ' ' }
      'py' { (& py --version 2>&1) -join ' ' }
    }
    $lines.Add("$name=$version")
  } catch {
    $lines.Add("$name=FOUND_BUT_FAILED: $($_.Exception.Message)")
  }
}
try { $lines.Add("docker-compose=$((& docker compose version 2>&1) -join ' ')") } catch { $lines.Add('docker-compose=FAILED') }
$lines | Set-Content -LiteralPath $Report -Encoding UTF8
$lines
Write-Host "报告：$Report" -ForegroundColor Green
