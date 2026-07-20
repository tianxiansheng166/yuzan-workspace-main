$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtime = Join-Path $dir 'web-runtime'
$server = Join-Path $runtime 'server.mjs'
if (-not (Test-Path $server)) {
  Write-Host "未找到统一运行时服务器：$server" -ForegroundColor Red
  exit 1
}
$env:PORT = if ($env:PORT) { $env:PORT } else { '4175' }
Write-Host "正在启动语赞心声统一演示站点，端口 $env:PORT ..." -ForegroundColor Cyan
Write-Host "入口地址：http://127.0.0.1:$env:PORT/" -ForegroundColor Cyan
node $server
