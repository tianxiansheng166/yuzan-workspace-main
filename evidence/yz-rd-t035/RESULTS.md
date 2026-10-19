# YZ-RD-T035 结果

- TASK_ID: `YZ-RD-T035`
- STATUS: `PASS_WITH_FINDINGS`
- MAIN_BEFORE_AFTER_UNCHANGED: `YES` — 原工作树 HEAD、分支、porcelain 状态及 19 个任务源文件哈希一致；178 个原课程资源逐文件 SHA256 复核一致。
- SOURCE_SHA256_PARITY: `PASS` — 19/19 原始双语源码/测试文件与独立封存提交字节一致；课程资源 178/178 前后哈希一致。
- SOURCE_SEAL_COMMIT: `509e0f452ad51cff4ddea3114a70352ed9a54eaf`（19 个允许源码文件的封存提交；分支 `yz-rd-t035-seal`）
- BILINGUAL_CONTRACT: `PARTIAL / FAIL` — 字段/学生展示门禁存在；真实审核来源和字幕发布审核合同未建立，详见下文。
- PASS_FAIL_SKIP_NOT_RUN: PASS — 哈希/状态一致性、OpenAPI lint、Contracts TypeScript 检查、双语前端 Node 测试；FAIL — 审核人/审核记录权威性、字幕审核发布门禁；NOT_RUN — API Vitest、隔离运行时/E2E；SKIP — 无。
- L4_OPEN: `NOT_TOUCHED / NOT_CHECKED`（未访问 L4 事故状态；未运行 Docker）。

## 范围与基线

- 原工作区：`/home/tian/code/yuzan-workspace-main`；开工与收尾 HEAD 均为 `9c77c8cd35ffd45d6a164cc7a4ec616c3345fd15`，分支均为 `feat/question-bank-v1`。
- 原始 `git status --porcelain=v1 -z` 前后 SHA256 均为 `4006981329ea738ff267bee044e283e637b4e271892f2707296804d8759359f8`，20 项状态字节完全相同；可读快照见 `MAIN_GIT_STATUS_BEFORE_AFTER.txt`。
- 本次只核对原工作区现有的 15 个 tracked 修改和 4 个 untracked 双语源码/测试文件。源文件 SHA 清单：`SOURCE_SHA256_BEFORE.txt` 与 `SOURCE_SHA256_AFTER.txt`（清单 SHA256 `ba310bcc1c7ed1e1d5378858e51d004fc52012e7660591d9200cd74ea2c13a10`；两份逐字节相同）。
- 受保护目录 `习题课程资源/` 有 178 个普通文件，共 1,967,035,976 字节。清单 `COURSE_RESOURCES_SHA256SUMS.txt` 记录每个原始相对路径及 SHA256（清单 SHA256 `0182961a9a98b8f38565716801d85a313d28d040c7ab02a21a807f7d5dd80d60`）；第二轮 `sha256sum --check --quiet` 退出码 0，178/178 匹配。资源目录未复制进独立工作树、未跟踪、未暂存、未提交；原仓库对该目录的 `git ls-files` 结果为 0。
- 独立工作树：`/home/tian/code/work/yuzan-workspace-t035`，基线同为 `9c77c8cd35ffd45d6a164cc7a4ec616c3345fd15`。源码封存提交恰为 19 个文件，其中资源路径 0；工作树已提交且干净。未推送。
- 仓库 `AGENTS.md` 未包含 `AA-DEV-V2.2-20261017` 标记；按会话提供的本地规则和本任务卡的显式限制执行，并记录此差异。已读取仓库 `CURRENT_HANDOFF.md` 与当前交接文档中“保留 T005 双语源码/原始资源”的接受状态。

## 双语发布合同核查

- **PASS：语言字段含义分开。** `locale` 表示原文语言，`translationLocale` 表示译文目标语言；存在非空译文时发布校验要求目标语言标签。当前校验为基本语言标签正则，覆盖常见 `zh-CN` / `bo-CN`，并非完整 BCP-47 解析器。
- **PASS：学生正文输出有限制。** 后端仅在原文语言为 `zh`、译文目标为 `bo`、译文非空、`reviewStatus=EXPERT_CONFIRMED` 且来源为 `EXPERT` 或 `COMMUNITY` 时才返回译文；前端使用相同条件并以 `textContent` 渲染。`PENDING` 会阻止发布；`AUTO`/`NONE` 不能标为 `EXPERT_CONFIRMED`。机器译文等普通 `REVIEWED` 内容可随课程发布，但不会被学生 API 返回为译文。
- **FAIL：字段门禁不能证明真实审核。** `BilingualContentDto` 允许课程作者提交 `translationSource` 与 `reviewStatus`；发布验证器只检查自报枚举组合，没有审核人身份、审核事件/证据或与独立翻译任务的关联。E2E 夹具也直接构造 `EXPERT_CONFIRMED`，且声明其内容为 `TEST_FIXTURE_ONLY`，不构成实际藏文或专家审校证据。独立 `translations` 模块的 `APPROVED` 状态没有与课程内容绑定。因此只能证明“标记为专家确认后才展示”，不能证明“经真实专家审核后才发布”。
- **FAIL：字幕发布没有双语审核合同。** 学生课程 OpenAPI/服务投影未定义审核过的藏文字幕字段；服务端活动内容白名单也未包含字幕 URL。旧播放器代码在收到 `subtitleBoUrl` 时会直接建立 `bo` 字幕轨道，没有检查 `translationLocale` 或 `reviewStatus`。所以当前不能证明字幕 URL 的来源、审批和发布门禁；本任务未修改这部分。

## 检查结果

- PASS — OpenAPI Redocly lint：`openapi/openapi.yaml` validated。
- PASS — Contracts TypeScript：`tsc -p tsconfig.json --noEmit`。
- PASS — 双语前端 Node 测试：2 个测试文件，8 passed，0 failed。
- PASS — `git diff --cached --check`；封存 commit 的 19 个路径与显式允许清单一致。
- NOT_RUN — API Vitest：隔离工作树没有安装依赖；没有在原始工作树安装或借用其 `node_modules`。
- NOT_RUN — E2E/实时数据库/浏览器运行：E2E 脚本要求 Docker，而本任务明确禁止 Docker；仅只读审阅脚本与夹具。
- NOT_RUN — 真实教研/藏文翻译审校、生产字幕发布、物理设备与试点。

## 审核文件 SHA256 清单

- `SOURCE_SHA256_BEFORE.txt` / `SOURCE_SHA256_AFTER.txt`: 19 个源文件，哈希完全相同。
- `COURSE_RESOURCES_SHA256SUMS.txt`: 原始课程资源逐文件清单，已完成前后核对。
- `MAIN_GIT_STATUS_BEFORE_AFTER.txt`: 原始分支/HEAD/porcelain 状态前后记录。
