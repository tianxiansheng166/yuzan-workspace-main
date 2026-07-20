@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not defined PORT set PORT=4175
echo 正在启动语赞心声统一演示站点，端口 %PORT% ...
echo 入口地址：http://127.0.0.1:%PORT%/
node "web-runtime\server.mjs"
