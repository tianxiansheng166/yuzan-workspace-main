# CURRENT: 中心恢复点

更新时间：2026-07-26

## 唯一运行目标

- canonical 主目录：`D:/program/test_program/yuzanxinsheng/three/yuzan-next`；
- 默认运行分支：`main`；并发目录 `../worktrees/` 只用于隔离开发和 integration 验证；
- 活动集成线：`integration/p0-multitrack-001`；本次候选为当前 integration HEAD；
- 启动命令：在 canonical 主目录运行 `./scripts/local-runtime/start-main.ps1`；脚本拒绝
  worktree、脏树和落后于 `origin/main` 的运行目标。

## 本次已进入 integration 的检查点

- 学生课程练习：真实录音、书面答案、课程回写和新会话恢复，已验证；
- 学生课程活动提交：integration 重跑 frontend 8、API 26、contract validation；待硬化浏览器验收；
- 教师 AI 教案：API 23、worker 25、API/worker typecheck 已通过；真实 Flowise provider 仍未闭环；
- 藏汉翻译：45 单元测试、Prisma validate、API/worker typecheck 已通过；provider/合规/前端闭环仍 BLOCKED，必须显式不可用；
- 产品 Web PRD 与项目研究文档：已保留在 integration。

检查点不是“产品全部完成”的声明。只有故障态真实、跨任务验证通过且记录风险后才提升 main；
正式试点/生产另依完整 release 验收。

## 下一恢复动作

1. 在 integration 运行 hardening：全仓 typecheck/build/test，API 与前端启动/健康检查，记录既有 lint 基线；
2. 通过后 push integration，在 canonical `main` 运行 `promote-integration.ps1` dry run，再用 `-Apply` 快进；
3. 从 canonical 主目录运行 `start-main.ps1`，访问登录页与 readiness；
4. 更新本文件为 main commit，并把 task worktree 的未提交本地诊断保留原处，不混入主目录。
