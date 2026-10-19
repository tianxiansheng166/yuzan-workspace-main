# YZ-RD-T042｜学生首页、教师名单、学习历史集成验收

## Return fields

| Field | Result |
|---|---|
| `TASK_ID` | `YZ-RD-T042` |
| `STATUS` | `ACCEPTANCE_VERIFIED / READY_TO_MERGE=NO` |
| `BRANCH` | `feat/yz-rd-t042-student-showcase-roster-history-integration`；独立分支，未合并共享分支 |
| `START_SHA` | `a676c99f81400b950b3de00f98e83dea05622485` |
| `FINAL_SHA` | 以最终任务回执中的分支 HEAD 为准；本文件与验收代码一起提交 |
| `REAL_STUDENT_FLOW` | PASS。真实登录表单登录 T042 PostgreSQL 中的测试学生；Today 显示听/说/测/评四入口；进入授权课程与其动态正文、录音要求练习、一级测评；真实 Runner 提交后先处于 `PROCESSING`，报告数为 0 且 Today 不显示成绩；教师按流程复核后生成完整 `STANDARD` 合法 0 分报告；A/B/跨校隔离通过。T042 新增跨模块流程从 Today 启动 Attempt，经学习历史继续同一 Runner。 |
| `REAL_TEACHER_FLOW` | PASS。真实教师登录表单进入授权 35 人班级；搜索、风险/正式成绩筛选、活动/进度排序、学生详情与返回筛选状态通过；匿名/跨校/未分配教师/缺失班级权限状态通过。 |
| `HISTORY_REPORT_IDENTITY` | PASS。History E2E 的正式 0 分 Attempt `f338ccc8-781a-4154-98db-e6864b7008b9` ↔ Report `8f4e2b32-7020-4011-a2ce-35f4068d4b24`，SQL 显示属于 Enrollment `f1111111-1111-4111-8111-111111111111` 且 score `0`。Today/Growth 另一个真实报告 `e279a3b2-682a-4204-83cb-1512f831df38` ↔ `COMPLETED/STANDARD` Session `c17d0c75-d30d-4c3e-88da-dbace475c94d`，归属测试学生 `94bd9ccd-914a-4162-9466-f6fae56454cb` / Enrollment `c4fed859-f98e-4707-b393-6cdda6038451`，`dataCompleteness=100`、`overallScore=0`，报告 API、Today、Growth 和 SQL 一致。T042 续做 Attempt `640aafcd-98ae-4c20-9e93-066fd33c25e4` 在 Today、History、Runner、API、PostgreSQL 的 ID 一致，仍属同一学生 Enrollment，状态 `IN_PROGRESS`。 |
| `CSV_SQL_PARITY` | PASS。筛选显示 `3/35` 时，导出授权全班 CSV 共 35 行；独立 PostgreSQL ACTIVE Enrollment 查询 35 行，CSV/SQL 全字段行集匹配。显式 `0` 保持为 `0`，空/NULL 分数保持空单元格。 |
| `CHROMIUM_API_PG_MINIO` | PASS。Google Chrome `153.0.8010.52`、Node `v24.20.0`、pnpm `10.13.1`、NestJS API、PostgreSQL `17.11`、Redis、MinIO 在独立 T042 原生环境运行；DB `yuzan_t042_native` / role `yz_t042`，bucket `yz-t042-native`。题库只读导入 120 道题/600 分/126 个媒体文件，绑定 120/120，0 错误/警告，复用 6 个正式练习定义与 delivery。 |
| `FOUR_VIEWPORTS` | PASS。学生 Today、教师名册、学习历史均验证 390/768/1280/1440；文档无水平溢出。教师导出按钮、名单滚动容器、键盘焦点与状态播报通过。截图见 `screenshots/`、`teacher-roster/`、`student-history/`。 |
| `PASS_FAIL_SKIP_NOTRUN` | 原生跨模块 E2E `5 PASS / 0 FAIL / 0 SKIP`；前端 `130 PASS / 0 FAIL / 0 SKIP`；API 全套 `1109 PASS / 0 FAIL / 64 环境门控 SKIP`；Contracts `6 PASS / 0 FAIL / 0 SKIP`；workspace TypeScript 与 build PASS。未运行：物理麦克风、校准语音评分、学校试点、生产数据/发布。 |
| `FULL_API_LINT` | 已重跑，命令以 `@yuzan/api lint` 执行；退出码 1，`1201 errors / 1 warning`。数量与 T033/T037 记录的历史基线一致。详见下方质量债务与完整输出 `full-api-lint.txt`。 |
| `READY_TO_MERGE` | NO。全量 API lint 的既有阻塞仍需 API Owner 修复或明确豁免；T042 未豁免，也未合并共享分支。 |
| `L4_OPEN` | OPEN；未访问/触碰。 |

## 本次集成运行

- 五条测试均在当前 T042 集成检出和同一套新运行的 Chromium/API/PostgreSQL/Redis/MinIO 环境中执行，不引用 T034/T036/T037 来源分支的历史 E2E 结果：T034 名单 1 条、T037 首页/报告 2 条、T036 历史 1 条、T042 Today→History→同一 Attempt 续做 1 条。
- Today 的一级测评是授权 `SYSTEM` 练习，未出现在普通练习目录列表中。集成验收发现特色卡片曾因此错误退回练习中心；现已改为直接使用 Today 返回的授权 definition ID，并用回归测试覆盖目录不含 `SYSTEM` 项的情形。
- 学生登录、课程、练习、报告、Review、Attempt 和 CSV 均经过真实浏览器/API/PostgreSQL 路径。T034 班级、T036/T037 测试身份、课程正文和录音均为隔离数据库中的 `TEST_FIXTURE_ONLY` 数据，不是学校生产学生数据。音频由 Chromium fake microphone 上传至本次 MinIO，标记 `SIMULATED_MIC`；没有运行 Worker 或自动语音评分。
- 接受的 Question Bank 输入只读：导入前后源文件 SHA-256 一致，证明见 [question-bank-source-proof.json](question-bank-source-proof.json)；题库验证输出见 [question-bank-preflight.txt](question-bank-preflight.txt)。
- 当前原生运行摘要：[native-runtime-evidence.json](native-runtime-evidence.json)；五条 E2E 汇总：[native-e2e.txt](native-e2e.txt)。

## 学生端证据

- 首页通过登录表单完成真实 HTTP 登录并选中当前学校，API 返回动态听/说/测/评四入口。Today 的“听”打开当前 enrollment 授权的 OPEN Assignment 和课程正文；“说”打开 `requiresRecording=true` 的授权练习；“测”打开 Today 返回的 Level 1 BASELINE 定义详情。
- 20 题实际作答通过 Runner 提交；自动可判题和教师复核走正常流程。教师复核前 Session 为 `PROCESSING`，没有 `AssessmentReport`，Today 保持无成绩/学习记录入口；教师完成所需复核后，服务端生成 0/100 的完整正式报告。数据库、报告 API、Today 和 Growth 显示一致。
- Student A/B、同校其他学生与跨学校身份的课程、练习、报告和历史权限负例通过。T036 覆盖 `401/403/404/409`；Today/report 流程覆盖匿名 `401`、同校其他学生与跨校隔离及缺失报告。
- T042 独立续做 proof：[t042-cross-module-student-proof.json](t042-cross-module-student-proof.json)，截图 [t042-history-attempt-resume-1280.png](screenshots/t042-history-attempt-resume-1280.png)。T037 首页、报告与 pending 证据：[today-showcase-proof.json](today-showcase-proof.json)。完整 T036 History 身份、报告、游标和 SQL 证据：[e2e-proof.json](student-history/e2e-proof.json)。

## 教师端证据

- PostgreSQL 中 35 条 ACTIVE STUDENT Enrollment 与教师 API 名单 ID 集一致。搜索、风险/成绩筛选、按最近活动与课程进度排序、同名学生区分、详情点击及返回保留合法筛选状态通过。
- `3/35` 可见状态下下载全班授权 CSV，35 数据行和 PostgreSQL 查询完全一致，且保持 0 与 NULL 分离；匿名 `401`、跨校 `403`、同校未分配教师 `404`、缺失班级 `404` 通过。
- 行级 API/SQL、交互状态、响应式指标见 [t034-browser-database-evidence.json](teacher-roster/t034-browser-database-evidence.json)。

## 质量债务和安全边界

- 全量 API lint 统计为 `1201 errors / 1 warning`，与既有 T033 基线同数：其中 164 个 `backend/api/test` 文件不在 ESLint TypeScript project service 中，逐个报 `project service` parsing error；其余错误主要为 `no-unused-vars` 339、`no-unsafe-member-access` 202、`require-await` 155、`no-unsafe-assignment` 93、`no-unnecessary-type-assertion` 88 等；唯一 warning 是未命中的 `eslint-disable no-console`。当前完整输出：[full-api-lint.txt](full-api-lint.txt)。
- 为能在干净工作树实际执行该 lint，本分支补上 `backend/api` ESLint 配置直接导入但此前未在该包声明的开发依赖 `@eslint/js@9.39.4`。依赖修复使 lint 可运行，未减少历史规则债务。
- workspace `pnpm typecheck` 与 `pnpm build` 全部通过；Contracts OpenAPI lint 与生成器测试 6/6 通过。前端 130 项通过，新增测试覆盖 SYSTEM 测评不在普通目录列表时仍从 Today 打开授权定义。
- 本 checkout 的 `AGENTS.md` 没有 `AA-DEV-V2.2` 标记，Task Card 未附 Lane V2.2 文档引用；依照本轮用户提供的 `/home/tian/code/AGENTS.md` 安全基线执行。T005 原工作树状态哈希前后均为 `73a40f1f863421c581688fca5fd9cec2d18613768c3c0386d3cd40ed490e5f72`；题库源哈希不变。未用 Docker/Compose、未改其他研发线工作树、未合并共享分支，L4 保持 OPEN。
- T042 六个端口 `55692/6492/59492/59493/4192/4392` 均已释放；`native-runtime-evidence.json` 记录服务 PID 退出、端口无监听、`startExitCode=0`、`e2eExitCode=0`、`stopExitCode=0`。PostgreSQL 数据、MinIO 对象及证据为本地审计保留。
