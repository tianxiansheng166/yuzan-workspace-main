# 主路径迁移清单（2026-07-22）

## 目标布局

```text
three/
├── yuzan-next/       # 当前 P0 集成项目，唯一主仓库
├── worktrees/        # 并发 Git worktree
└── legacy-archive/   # 全部旧项目与恢复材料
```

当前 Codex 会话仍占用旧空目录 `workers/p0-integration`。本会话结束后运行归档中的 `cleanup-empty-workers-after-session.ps1`；它只删除空目录壳，若出现新文件会先移到 `session-residue-20260722`。

## 迁移映射

| 原位置                   | 新位置                                                      | 说明                                            |
| ------------------------ | ----------------------------------------------------------- | ----------------------------------------------- |
| `workers/p0-integration` | `yuzan-next`                                                | 当前主项目、Git 和运行配置                      |
| 旧 `yuzan-next`          | `legacy-archive/root-before-p0-20260722/yuzan-next`         | 旧主仓库，保留 27 项本地状态                    |
| 其他 `workers/*`         | `legacy-archive/workers-before-p0-20260722/*`               | 各自完整 Git 仓库                               |
| 旧 `worktrees/*`         | `legacy-archive/worktrees-before-p0-20260722/*`             | 旧并发现场                                      |
| 根历史资料和配置         | `legacy-archive/root-before-p0-20260722/*`                  | 包含旧 pnpm store、提示词、archive、A-source 等 |
| 旧 P0 `node_modules`     | `legacy-archive/dependencies-before-path-switch-20260722/*` | 路径迁移前依赖证据                              |

## Git 恢复点

- 主项目提升前：`49b8277c3b8cd7572b7c087db0eb79dda3fc5c0b`
- 旧主仓库：`2609380`，分支 `integration/four-port-role-navigation-connectivity-003`
- `p0-contract`：`b5d6019`，干净，`git fsck` 通过
- `p0-product-spec`：`a3792e9`，干净
- `p0-student-design-package`：`64edb74`，干净
- `p0-student-functional-closure-001`：`a78c927`，干净
- `p0-tests`：`d206378`，保留 `frontend/login/styles.css` 修改和 `.baseline-api.txt`

## 依赖与运行时

- Node：`24.18.0`
- pnpm：`10.13.1`
- 锁文件已补入 worker 的 `ajv` 依赖；
- 冻结离线安装通过；
- 新 `node_modules` junction 未发现旧 `workers/p0-integration` 路径；
- PostgreSQL `55432`、Redis `6380`、MinIO `59000`、Flowise `4300` 可达；
- API live/ready 和语音 `/health` 已从新路径实际启动验证。

## 回滚

1. 停止从 `three/yuzan-next` 启动的本地服务。
2. 将当前主目录整体移到新的故障保全目录，不覆盖归档。
3. 将 `legacy-archive/root-before-p0-20260722/yuzan-next` 移回 `three/yuzan-next`。
4. 恢复旧根配置时逐项移动，不覆盖同名文件。
5. Docker volume 未在本次迁移中删除，数据库无需数据回滚。
