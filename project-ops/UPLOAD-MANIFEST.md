# UPLOAD-MANIFEST: 迁移上传清单

> 生成时间：2026-07-09

## 已纳入的目录/文件

| 来源                                            | 目标                           | 说明                                   |
| ----------------------------------------------- | ------------------------------ | -------------------------------------- |
| `runtime-prompts/wave0/*.txt`                   | `project-ops/runtime-prompts/` | Wave 0 正式任务提示词                  |
| `runtime-reports/*.md`                          | `project-ops/runtime-reports/` | 环境交接、基线就绪、审查报告等正式报告 |
| `runtime-reports/wave0-preparation-summary.txt` | `project-ops/runtime-reports/` | Wave 0 准备摘要                        |
| `README-FIRST.md`                               | `project-ops/imported-notes/`  | 工作区总体说明                         |
| `START-HERE-CHECKLIST.md`                       | `project-ops/imported-notes/`  | 开工检查清单                           |
| `第0步骤提示词.md`                              | `project-ops/imported-notes/`  | Wave 0 准备提示词                      |
| `PACKAGE-VALIDATION.md`                         | `project-ops/imported-notes/`  | 包内验证记录                           |
| `SETUP-WITH-LEGACY.md`                          | `project-ops/imported-notes/`  | 与旧项目并置使用说明                   |
| `CHANGELOG.md`                                  | `project-ops/imported-notes/`  | 变更日志                               |
| `临时提示词1.md`                                | `project-ops/imported-notes/`  | 本次迁移总控提示词                     |

## 已排除的目录/文件

| 路径                                                     | 排除原因                       |
| -------------------------------------------------------- | ------------------------------ |
| `runtime-reports/baseline-logs/*.log`                    | 运行时日志，属于临时生成物     |
| `runtime-reports/wave0-cleanup-logs/*.log`               | 运行时日志，属于临时生成物     |
| `worktrees/**`                                           | 本地执行环境，非版本管理内容   |
| `legacy/source-tree/**`                                  | 旧项目原始源码，禁止上传       |
| `.env` / `.env.*`                                        | 环境变量与密钥，禁止上传       |
| `node_modules/`                                          | 依赖目录，可通过 lockfile 重建 |
| `.nuxt/` / `.output/` / `dist/` / `build/` / `coverage/` | 构建产物                       |
| `infra/database/generated/`                              | Prisma 生成代码，可重建        |
| 数据库/MinIO 数据                                        | 运行时数据，禁止上传           |
| `*.bundle`                                               | 备份包，不入库                 |
| `~/.trae-cn` / Codex/Trae 本地缓存                       | 工具私有缓存                   |
| `/tmp` 文件                                              | 临时文件                       |

## 隐私扫描结论

- 已扫描 `project-ops/` 下的所有文本文件。
- 发现 `ENVIRONMENT-HANDOFF.md` 原稿包含个人邮箱，已在复制时脱敏为 `[REDACTED]@example.com`。
- 未发现真实手机号、身份证号、私钥、SSH 密钥、Token、密码等敏感内容。
- 历史运行报告中保留的绝对路径（如 `/home/admin01/Documents/...`）仅用于记录历史执行环境，物理机不得直接复用。

## 版权风险结论

- 纳入的文件均为项目自有协作记录、提示词、报告和说明文档。
- 未纳入旧项目源码、第三方授权素材或未知来源文件。
- 无已知版权风险。

## 大文件检查结论

- Git 仓库中未发现 50 MiB 以上的 blob 对象。
- 未发现超过 100 MiB 的对象。
- 上传内容均为文本文件，大小可控。

## 关于历史报告中绝对路径的说明

部分报告（如 `ENVIRONMENT-HANDOFF.md`、`WAVE0-DISPATCH-READINESS.md`、`GOV-002-GOV-003-CROSS-REVIEW.md`）保留了 VM-UBUNTU 上的历史绝对路径。这些路径：

1. 仅作为历史执行记录；
2. 不代表物理机必须使用相同路径；
3. 新任务应通过仓库根目录动态解析路径；
4. 物理机 clone 后应在本机独立选择 worktree 位置。
