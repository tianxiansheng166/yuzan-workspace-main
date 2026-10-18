# YZ-RD-T012 交付结果

## TASK_ID / STATUS

- `TASK_ID`: `YZ-RD-T012`
- `STATUS`: `DONE`
- 仅修改学生网页版练习中心和 Unified Runner；没有新建练习后端、Attempt、录音或评分体系。

## EXACT_SHA_BRANCH_PUSH

- 基线：`9b4340081e7d330007368062a898f4c11d29a14f`
- 分支：`feat/yz-rd-t012-student-practice-ux`
- 最终提交 SHA 与 `origin` 推送核验结果由任务回传中的 Git 结果给出。

## OWNED_FILES_AND_DESIGN_SYSTEM

- 练习中心交互：`frontend/assessment/assets/practice.js`
- Runner 交互：`frontend/assessment/assets/runner.js`
- 新 SVG/CSS 组件：`frontend/assessment/assets/practice-visuals.js`、`frontend/assessment/assets/practice-visuals.css`
- 页面接入：`frontend/assessment/practice-shell.html`、`frontend/assessment/runner.html`
- 独立前端测试：`frontend/tests/assessment/student-practice-runner-t012.test.mjs`
- 原生 E2E：`tests/e2e/assessment/test_yz_rd_t012_student_practice.py`、`tests/e2e/assessment/run-yz-rd-t012-native.sh`
- 设计系统使用自有路径 SVG、明确 focus ring、语义状态色、渐变按钮、层级阴影与响应式排版。图标 SVG 为装饰内容并设为 `aria-hidden`；交互控件提供可访问名称和 `aria-pressed`。

## UX_INTERACTIONS_REAL_STATE

- 收藏按钮已移出卡片链接，鼠标和键盘收藏不再误跳详情；卡片空白区域进入详情。
- 分类、专项、模拟练习、收藏、筛选、真实训练元数据、教师开放任务、Attempt 续练与历史状态由服务器数据呈现。
- `CREATED` / `IN_PROGRESS` 继续作答；`SUBMITTED` / `PROCESSING` / `FAILED` 进入处理状态；`COMPLETED` 查看正式报告；`CANCELLED` 明示不可继续。详情页不会为已有 Attempt 再创建一次。
- Runner 使用真实题目音频播放状态，服务器答案保存结果驱动题目导航和进度；保存失败保留答案并提供重试。
- 麦克风权限、倒计时、录音、试听、等待上传、上传中、上传失败、重试、服务器确认保存均单独展示。录音输入电平使用 WebAudio `AnalyserNode` 样本；音频播放动画只表达播放状态，不冒充输入能量。
- 录音使用浏览器 `getUserMedia` / `MediaRecorder`、本机 IndexedDB 草稿、现有 Signed PUT、Recording Complete、AssessmentItem Attach 与 SpeechJob 接口。签名重试沿用幂等键；只有服务器重新读取题目并确认绑定后才显示已保存。
- 交卷先展示确认对话框，键盘焦点受限于对话框，Escape 关闭并恢复焦点；未完成题目不可误交。
- 模拟练习标明并非官方考试或正式成绩。页面不展示虚构成绩。

## PRACTICE_RUNNER_E2E_SQL_S3_PROOF

- T012 原生 Chromium + API + PostgreSQL 17 + Redis 7 + MinIO：`1 passed, 0 skipped`。
- 本次 Attempt `ed2bacec-e0da-4851-9517-da658aa519eb` 在提交后由 SQL 确认为 `PROCESSING`；同一 Attempt 刷新后恢复并出现在个人历史。四题真实 Attempt，提交请求只发送一次。
- SQL 检查：2 个 SpeechJob 关联 2 个不同 Recording；`AssessmentReport` 数量为 0，已评分语音题数为 0。
- MinIO `HeadObject` 确认两个真实上传对象存在：24446 与 23480 字节，类型均为 `audio/webm;codecs=opus`。每道题同一幂等键只产生 1 条 Recording。
- 结构化证据：[e2e-summary.json](e2e-summary.json)。视口截图覆盖 1920、1440、1280、390 px；目录、详情、Runner、交卷确认均有截图。每个视口均断言文档无横向溢出。

## NEGATIVE_AND_RECOVERY

- 无会话请求返回 `401`；跨学校请求 `403`；缺失 Attempt `404`；学生 B 的跨学生 Attempt 查询 `404`，且 B 目录中不显示学生 A 的 Attempt。
- 拒绝麦克风权限不会创建 Recording。
- 篡改 Signed PUT 签名返回 `403`；MinIO 对象仍不存在，Recording 保持初始化状态；使用同一幂等键重试后保存成功，未创建第二条有效 Recording。
- 中断上传网络后可重试；重试成功并且每个题目只有一条 Recording。重复点击确认及重复提交同一 Attempt 没有重复创建提交记录。
- 刷新和返回练习中心后，继续链接仍指向同一 Attempt；处理页可返回历史并看到服务器处理状态。

## SVG_ACCESSIBILITY_REDUCED_MOTION

- SVG 图标可通过 `currentColor` 跟随状态色；装饰图标和波形隐藏于辅助技术，不重复朗读。
- 控件有可访问名称，收藏状态暴露 `aria-pressed`，题目进度使用 `progressbar`，提交确认使用 `role=dialog` / `aria-modal`。
- `:focus-visible` 有高对比描边；原生 E2E 验证提交对话框 Tab 焦点循环、Escape 关闭与焦点恢复。
- CSS 提供 `prefers-reduced-motion: reduce` 规则。录音能量波形使用实时麦克风分析；`SIMULATED_MIC` 清楚标记自动化测试音源。

## TESTS_PASS_FAIL_NOT_RUN

- `pnpm --filter @yuzan/frontend test`：38 passed，0 failed，0 skipped；frontend runtime verification PASS。
- API 回归 `pnpm --filter @yuzan/api test -- test/assessment/practice.service.spec.ts`：完整 API Vitest suite 1082 passed、64 skipped；72 个测试文件通过、10 个文件被套件配置跳过。T012 未修改 API 源码。
- T012 原生 Chromium E2E：1 passed，0 skipped；录音与对象存储均为真实浏览器/API/MinIO 流程，没有 Mock 响应。
- T010 原生回归：T007 assignment `1 passed`。T008 student history 首轮暴露重复错误提示，T012 已修复；第二轮完成录音上传与重试后，旧用例在提交环节超时，因为它直接双击“交卷”并等待跳转，没有确认新增的交卷对话框。此失败是旧用例未适配确认步骤；同一交卷确认流程已由 T012 E2E 覆盖并通过。T010 服务已停止。
- JavaScript `node --check`、原生脚本 `bash -n`、Python `py_compile`、Prettier 检查及 `git diff --check` 在最终交付前核验。
- 未运行 Docker 相关测试；旧 `question-bank-runner.spec.py` 会调用 Docker，按任务约束排除。没有单独重跑 T010 专用 20 项题库流程；T012 自有 E2E 验证四题多题型 Attempt、音频、两道真实录音、提交、刷新与历史。

## API_REQUESTS_TO_T011

- 本次网页流程可复用现有接口，无阻塞性 API 缺口；没有提交 API_REQUEST。
- 正式考试计时、防作弊与正式模拟考试模式没有后端持久化能力，页面只提供“模拟练习”训练体验，不声明官方考试或正式成绩。

## T005_T011_T013_NONINTERFERENCE

- T005 变更保留在主工作树；T012 使用独立 worktree/分支，没有编辑 T005 文件或资源。T010 回归读取原始题库资源并写入其独立本机测试数据库和 Bucket，没有改写源资源。
- T010 与 T011 worktree 均未被 T012 修改；T011 负责的共享 API、OpenAPI、Teacher Review、Native Runtime 文件均未触碰。
- T013 端口 `55631` 最终检查时无监听；T012 未停止或操作 T013 进程。T012 与 T010 回归服务在各自任务运行目录和端口启动，并由各自脚本停止。
- 未使用 Docker；L4 默认 PostgreSQL 卷事故未处理，保持 OPEN。

## NATIVE_PROCESS_EXIT

- T012 脚本报告：`T012 native process exit: PASS; all task-owned ports are free.`
- T012 与 T010 本机测试服务均已停止；PostgreSQL 数据目录及 MinIO 测试对象保留在忽略目录中供复核，没有删除测试数据。

## NEXT_STUDENT_GAPS

- 语音评分 provider 在此隔离环境中为 disabled；SpeechJob 保持 CREATED，Attempt 合法地显示 PROCESSING，没有伪造诊断、报告或分数。需要后续接入/启用正式评分 worker 后再验证报告页。
- 当前录音使用 Chromium `SIMULATED_MIC` 输入；需要再用物理麦克风覆盖浏览器设备差异。
- 需要更新 T010 T008 浏览器回归，在确认对话框中点击“确认交卷”后再断言处理页，避免旧测试把新增确认流程误判为提交失败。
