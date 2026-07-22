# 主目录清理清单（2026-07-22）

## 结果

唯一主项目为 `D:/program/test_program/yuzanxinsheng/three/yuzan-next`。活跃源码现在按职责分为：

```text
frontend/                 当前唯一前端（静态运行时 + API 代理）
backend/api/              NestJS API
backend/worker/           后台任务 worker
backend/speech-scoring/   语音评分服务
packages/contracts/       OpenAPI 契约
packages/domain/          共享领域代码
infra/database/           Prisma 与数据库工具
project-ops/              任务、决策、恢复点和交接
```

`apps/`、`services/`、`web-runtime/` 和 `apps/apps-web/` 不再是有效源码路径。

## 外部归档

归档根：`../legacy-archive/root-cleanup-20260722/`

| 目录 | 内容 | 文件数 | 大小 |
| --- | --- | ---: | ---: |
| `apps-web/` | 旧 Nuxt 前端及其恢复内容 | 1,906 | 40.93 MiB |
| `frontend-evidence/` | 不被运行时引用的 QA、reference 图片和报告 | 291 | 252.51 MiB |
| `unused-workspace-packages/` | 未被活跃 workspace 使用的 ui/config/observability/test-utils | 75 | 0.10 MiB |
| `legacy-root-artifacts/` | 旧验证报告、临时测试脚本和运行日志 | 10 | 0.16 MiB |

这些目录是恢复材料，不参与 pnpm workspace、源文件搜索、测试或 CI。

## 依赖策略

- 只在仓库根执行 `pnpm install`；
- 每个 package 的 `package.json` 仍保留，用于声明依赖归属；
- package 下的 `node_modules` 是指向根 `node_modules/.pnpm` 的链接，不是重复安装；
- 根虚拟存储进一步复用全局内容寻址 store；
- 当前 workspace 共 7 个：root、frontend、API、worker、database、contracts、domain；
- 活跃安装中不再包含 Nuxt/Vue 条目。

## 配置与 Docker 审核

根 `.env.example`、根 `docker-compose.yml`、`infra/` 以及后端各服务自己的运行配置均保留在主项目中。真实 `.env` 仍仅本地使用且被 Git 忽略。API 从 `backend/api` 启动，frontend 通过 `4175` 代理到 API `4000`；迁移后的 readiness smoke 已通过。

## 回滚

1. 从 Git 恢复原目录及根脚本；
2. 从本清单列出的归档目录恢复旧 Nuxt、QA 证据或未使用 package；
3. 恢复旧 `pnpm-workspace.yaml` 与锁文件；
4. 在 Node 24 下执行 `pnpm install --frozen-lockfile`；
5. 重新运行数据库、typecheck、test、build 和 API proxy smoke。

不应直接在归档目录开发，也不应把整个归档重新加入 IDE/AI 的项目搜索范围。
