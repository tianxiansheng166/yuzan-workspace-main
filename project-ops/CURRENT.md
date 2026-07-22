# CURRENT: 中心恢复点

更新时间：2026-07-22

## 当前主项目

- 路径：`D:/program/test_program/yuzanxinsheng/three/yuzan-next`
- 治理分支：`task/gov-root-002`
- 本轮基线：`e42a67010092e6875394f1969292d1d751c2c7fe`
- 当前已审计提交：`077ec4274b49ef88ab085669908d9d075fe14aa6`
- GitHub：`git@github.com:tianxiansheng166/yuzan-workspace-main.git`
- 旧项目总归档：`../legacy-archive/`

## 当前目录与运行事实

- `frontend/` 是当前唯一产品前端，端口 `4175`；旧 Nuxt 前端已移出源码发现范围；
- `backend/api/`、`backend/worker/`、`backend/speech-scoring/` 是后端服务；
- `packages/contracts/`、`packages/domain/` 是仍参与构建的共享包；
- `infra/database/` 是 Prisma workspace，Docker 与环境模板仍位于主项目根和 `infra/`；
- pnpm 当前只有 7 个 workspace，所有包的 `node_modules` 都链接到根虚拟存储，不是独立依赖副本；
- 旧 Nuxt、前端 QA/参考图、未使用共享包和根级临时报告均在 `../legacy-archive/root-cleanup-20260722/`；
- `apps/`、`services/`、`web-runtime/` 已退出当前目录，不得重新创建；
- GitHub `main` 尚未更新，本轮交付先保留在 `task/gov-root-002`。

## 已验证基线

- Node 24 / pnpm 10 安装、数据库 generate/validate、全 workspace typecheck/build 均通过；
- frontend lint/test/build 通过；API 49 files / 903 tests 通过，另 55 tests 按既有配置 skipped；
- worker 2 files / 33 tests 通过，旧错误导入已修复；
- API readiness、登录页和 frontend -> API readiness proxy 均返回 HTTP 200；
- `.env`、依赖树、构建目录未进入 Git；同分支并发产生的两个提交已做路径与新增行密钥审计；
- 迁移详情、回滚位置和数量见 `project-ops/ROOT-CLEANUP-MANIFEST-20260722.md`。

## 已知风险

- 归档中的旧 worker 分支只作为恢复证据，仍未做逐提交业务等价性审查；
- 语音评分服务虽已通过健康检查，后续功能迭代仍应补正式代码审查；
- 当前 PostgreSQL 容器不由主 Compose 管理，任何接管或 volume 操作前必须先备份；
- 空的 `../workers/p0-integration` 可能被本次桌面会话句柄占用；退出会话后才能删除，不能再作为开发入口。

## 下一恢复动作

1. 从 `README-FIRST.md` 开始，只在任务 JSON 指定的 sibling worktree 开发；
2. 新功能先声明前后端/API 依赖及集成顺序，耦合切片不得无序并发；
3. 集成负责人复核 `GOV-ROOT-002` handoff 后再决定 GitHub `main` 快进时间；
4. 会话退出后删除空的 `../workers/p0-integration` 和空 `workers/`，使 `three` 只保留主项目、worktrees 与归档。
