# P0-STUDENT-COURSE-PRACTICE-001 Handoff

- Owner: Codex
- Reviewer: Integration Lead
- Branch: `task/p0-student-course-practice-001`
- Base commit: `61925325f4096d6a77b136201db6fa0a94dc0b53`
- Status: `READY_FOR_REVIEW`

## 用户结果

真实登录学生现在可以从教师分配的古诗文课程活动进入统一练习执行器，完成真实
麦克风录音和书面作答，提交练习后幂等回写课程活动。刷新或在全新浏览器上下文
重新登录后，服务端仍返回该活动已完成。

闭环没有使用 `demo=1`、固定业务 ID、静态成绩、假录音、假报告或前端假成功。
学校、课程、Submission、Activity、Practice、Attempt、Item 和 Recording ID 均由
登录后 API 动态发现或创建。

## 实现范围

- 修复课程详情 consumer，使其读取当前嵌套 `assignment/courseVersion/units/
  studentProgress/existingSubmission/practiceReferences`，并保留 instruction、
  content、resources、progress、attempt、submission status/revision。
- 课程练习入口向现有 practice provider 同时发送 `assignmentId`、
  `submissionId`、`activityId`，只使用复数正式路由。
- 将受限的同源课程返回路径与三 ID 上下文保存到 Attempt 级本地恢复点。
- Assessment 提交后调用幂等课程完成接口；若练习提交成功而课程回写失败，保留
  `PENDING` 上下文并只重试课程写入，不重复提交练习。
- 修复课程 loading/error/main shell 的 `[hidden]` CSS 契约，避免已加载内容被
  永久 loading 遮罩覆盖。
- OpenAPI 补充课程关联 practice create/resume 的可选请求体与响应契约；CCR：
  `project-ops/requests/CCR-P0-STUDENT-COURSE-PRACTICE-001.md`。
- Prisma schema、生产数据、权限语义、通用练习数据模型均未修改。

## 状态与安全

- 正常：真实 UI 从 0% 课程进入，2 个朗读项、2 个书面项完成后回到 25%。
- Loading：课程主壳层只在数据就绪后显示；CSS 回归测试覆盖 hidden 优先级。
- Empty/配置缺失：缺少 practiceReference 或任一课程上下文 ID 时在创建 Attempt
  前失败，不跳转到空路由。
- Error/offline：adapter 不再返回 success-shaped error；网络错误保留为明确失败，
  UI 恢复按钮可重试。
- Permission/tenant：错误 school、student、submission、activity/reference 均由
  服务端拒绝；跨学生完成写入失败。
- 中断恢复：Assessment 已提交、课程同步待完成时显示待同步状态；重试只执行
  幂等 `completeCoursePractice`。

## 实际验证

| 检查 | 命令 | 结果 |
|---|---|---|
| 课程 consumer / recovery | `node --test frontend/student/courses/course-detail/*.test.mjs` | PASS，8/8 |
| 学生课程 provider / tenant negatives | `pnpm --filter @yuzan/api test -- test/student-courses/student-courses.service.spec.ts` | PASS，9/9 |
| Practice create/resume/complete | `pnpm --filter @yuzan/api test -- test/assessment/practice.service.spec.ts` | PASS，8/8 |
| OpenAPI | `CI=1 REDOCLY_TELEMETRY=off NO_UPDATE_NOTIFIER=1 pnpm contract:validate` | PASS，zero exit |
| 全仓类型 | `pnpm typecheck` | PASS，6/6 workspace projects |
| 全仓构建 | `pnpm build` | PASS，6/6 workspace projects |
| 浏览器闭环 | `python evidence/p0-student-course-practice-001/course_practice_e2e.py` | PASS |
| Prisma 交叉核验 | `node evidence/p0-student-course-practice-001/verify_database.mjs` | PASS，2 oral + 2 written |
| Task review | `task-gate.ps1 -Mode review ...` | PASS |

浏览器验收使用本机 Python Playwright、headless Chromium 和浏览器 fake media
device；MediaRecorder 仍走真实 `getUserMedia`、真实 Blob、真实预签名 PUT、
Recording COMPLETE 和 AssessmentItem 绑定。两段受权回读合计 92,750 bytes，
每段 3,000 ms。最终 console errors、page errors、failed requests、HTTP errors
均为 0。

证据：

- `evidence/p0-student-course-practice-001/browser-result.json`
- `evidence/p0-student-course-practice-001/database-result.json`
- `evidence/p0-student-course-practice-001/01-course-practice-entry-1440.png`
- `evidence/p0-student-course-practice-001/02-submit-ready-1024.png`
- `evidence/p0-student-course-practice-001/03-course-completed-new-context-390.png`

## 本地复验

1. 使用 Node 24，并确保 PostgreSQL、Redis、MinIO、API 4000 和 frontend 4175
   指向本 worktree。
2. 从忽略的本地 `.env` 导入开发配置，运行 fictional seed。
3. 仅在 development/test，设置
   `YUZAN_E2E_STUDENT_IDENTIFIER`，运行
   `node evidence/p0-student-course-practice-001/reset_fixture.mjs`。
4. 再以环境变量提供学生 identifier/password，运行浏览器脚本；脚本和证据不保存
   password、token 或签名 URL。
5. 运行 `verify_database.mjs` 和上表精确测试。

`reset_fixture.mjs` 按测试学生、教师分配、古诗文语义动态查找目标，只删除该
development/test 学生在目标课程下的 Progress 和 Submission（其级联 Attempt/
Session），不会使用固定业务 ID，也不会运行于 production。

## 已知基线限制

- `pnpm lint` 不是本任务绿色门禁：API ESLint 配置导入未声明的 `@eslint/js`；
  临时解析该依赖后，全 API 基线仍有 971 errors + 1 warning，且大量 test 文件
  不在 project-service tsconfig。临时 junction 已清理，未修改共享 package/lock/
  ESLint/tsconfig。详见 `.learnings/ERRORS.md` 的 ERR-026/028。
- Redocly 非 CI 模式曾在打印“valid”后因 Windows update notifier 的 libuv 句柄
  退出断言失败；CI 模式独立重跑为真实 zero exit。
- 课程只完成关联 practice 活动，因此进度由 0% 变为 25%；其他三个普通课程活动
  属于后续闭环，不在本任务伪造完成。

## 迁移、回滚与集成

- Migration：无 Prisma migration，无生产数据迁移。新增 reset 仅用于
  development/test E2E fixture。
- Rollback：revert 本任务提交；OpenAPI 澄清、课程 consumer 桥、assessment
  recovery 和 CSS 修复一并回退。现有服务端课程/assessment/recording 数据仍由
  原 provider 管理。
- 合并顺序：依赖 `P0-STUDENT-GOAL-PLAN-001`，由 Integration Lead 复验后决定
  merge target；本任务不合并 main。
- 提交信息：`feat(student): close course-linked practice loop`。
