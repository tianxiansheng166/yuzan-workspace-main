# Browser Runbook — frontend-pixel-v4-adoption

## 目标
为 Codex 提供可重复的浏览器基线验证环境，支持 V3/V4 源运行时与正式 Nuxt 项目的截图对比。

## 工具链
- Node: `v24.18.0`（通过 `fnm use 24` 切换）
- pnpm: `10.13.1`
- Playwright: `1.60.0`（已随仓库依赖安装）
- Chromium: 已通过 `pnpm exec playwright install chromium` 安装到本地缓存

## 目录约定
- V3 源运行时：`D:\program\test_program\yuzanxinsheng\three\yuzan-next\source-materials\yuzan-pixel-v3-runtime`
- V4 源运行时：`D:\program\test_program\yuzanxinsheng\three\yuzan-next\source-materials\yuzan-pixel-v4-runtime`
- 正式项目 worktree：`D:\program\test_program\yuzanxinsheng\three\worktrees\frontend-pixel-v4-runtime-adoption-001`
- 截图输出：`design-lab\frontend-pixel-v4-adoption\preflight\{v3,v4,official-before}`

## 启动命令

### V3 源运行时（端口 4173）
```powershell
fnm env --use-on-cd | Out-String | Invoke-Expression
$env:PORT=4173
node server.mjs
```
Readiness: `curl http://127.0.0.1:4173/`

### V4 源运行时（端口 4174）
```powershell
fnm env --use-on-cd | Out-String | Invoke-Expression
$env:PORT=4174
node server.mjs
```
Readiness: `curl http://127.0.0.1:4174/`

### 正式 Nuxt 项目（端口 3000）
```powershell
fnm env --use-on-cd | Out-String | Invoke-Expression
pnpm --filter @yuzan/web dev
```
Readiness: `curl http://127.0.0.1:3000/`

## 一键截图
```powershell
fnm env --use-on-cd | Out-String | Invoke-Expression
node design-lab\frontend-pixel-v4-adoption\preflight\scripts\capture-baseline.mjs
```
该脚本会：
1. 在 4173/4174/3000 分别启动 V3/V4/正式服务；
2. 按 `390×844`、`768×1024`、`1440×900` 三个视口截图；
3. 输出到 `design-lab\frontend-pixel-v4-adoption\preflight\{v3,v4,official-before}`；
4. 生成 `baseline-report.json` 记录 HTTP 状态、URL、空白检测与错误；
5. 正常关闭所有子进程。

## 截图规范
- 每张截图文件名：`{routeId}-{width}x{height}.png`
- 失败标记：`baseline-report.json` 中 `error`、`httpStatus >= 400` 或 `blank: true` 视为失败。
- 成功标准：HTTP 成功、服务仍在运行、页面非空白、无错误页。

## 日志与调试
- 脚本内子进程 stdout/stderr 已捕获；运行失败时直接查看终端输出。
- 如需单服务调试，可手动启动服务后用 Playwright 单独截图。

## 正常 shutdown
- 脚本退出时会向所有子进程发送 `SIGTERM`。
- 手动启动时按 `Ctrl+C` 停止对应服务。
