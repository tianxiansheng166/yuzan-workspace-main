# 目标模式提示词：学生端课程关联练习真实闭环

下面“提示词正文”可以完整复制到 Codex 目标模式。它的目标不是继续写规划，而是按
仓库门禁把第一个学生真实闭环实现、验证、提交并推送。

---

## 提示词正文

你现在负责 `语赞心声 / yuzan-next` 的第一个学生端真实闭环。请持续推进，不要停在
分析、TODO、静态页面或只通过构建的状态；只有达到下面的完成定义才能结束目标。

### 一、唯一目标

实现并证明：

> 一名真实登录学生能从被分配的课程进入该课程关联的“古诗文朗读与理解训练”，
> 完成至少一条真实录音证据和一项书面作答，提交练习，返回原课程，并在刷新或新
> 浏览器上下文后仍看到该课程活动已完成。

任务 ID 固定为：

```text
P0-STUDENT-COURSE-PRACTICE-001
```

任务分支固定为：

```text
task/p0-student-course-practice-001
```

### 二、仓库与安全边界

唯一主项目：

```text
D:/program/test_program/yuzanxinsheng/three/yuzan-next
```

独立 worktree：

```text
D:/program/test_program/yuzanxinsheng/three/worktrees/p0-student-course-practice-001
```

先做只读检查：

1. 验证 canonical 路径、Git root、当前 branch、remote 和 status；
2. 保留 canonical 中所有已有未提交改动，不清理、不覆盖、不移动；
3. 不在 canonical 脏工作区直接开发；
4. 获取控制框架基线：
   - `git fetch origin task/p0-student-goal-plan-001`；
   - 如果 Integration Lead 已接受了一个更新且包含本提示词、
     `scripts/repo/task-context.ps1` 和完整开发框架的后代提交，使用该精确提交；
   - 否则将 `origin/task/p0-student-goal-plan-001` 解析成完整 40 位 commit 并使用；
   - 不猜基线，不把无关 integration branch 当基线；
5. 目标 worktree 或 branch 已存在时，先只读检查并恢复，不重复创建。

禁止使用破坏性 Git 命令，禁止 blanket cleanup，禁止删除用户未提交内容。

### 三、先建立任务元数据，再自动加载上下文

如果任务 JSON 尚不存在：

1. 从 `project-ops/templates/task.template.json` 创建：

   ```text
   project-ops/tasks/active/P0-STUDENT-COURSE-PRACTICE-001.json
   ```

2. 设置准确的 branch、完整 `base_commit`、用户结果、非目标、owner、最小测试、
   handoff、回滚和 delivery；
3. `context.required` 只放以下 6 个文件：

   ```text
   project-ops/AI-DEVELOPMENT-CONTRACT.md
   project-ops/plans/P0-STUDENT-CLOSED-LOOPS.md
   frontend/student/courses/course-detail/course-api-adapter.js
   frontend/student/courses/course-detail/exercise-controller.js
   backend/api/src/modules/student-courses/student-courses.service.ts
   backend/api/src/modules/assessment/practice.service.ts
   ```

4. `context.optional` 可列出 `frontend/assets/api-client.js`、
   `frontend/assessment/assets/app.js`、`frontend/server.mjs`、
   `infra/database/prisma/seed.ts` 和相关 spec；
5. `allowed_paths` 至少精确覆盖：

   ```text
   .learnings/**
   frontend/assets/api-client.js
   frontend/server.mjs
   frontend/student/courses/course-detail/**
   frontend/assessment/**
   backend/api/src/modules/student-courses/**
   backend/api/src/modules/assessment/**
   backend/api/test/student-courses/**
   backend/api/test/assessment/**
   packages/contracts/openapi/openapi.yaml
   project-ops/**
   evidence/p0-student-course-practice-001/**
   ```

6. 对 OpenAPI 或全局路由变更声明 shared owner；OpenAPI 变更先创建 CCR；
7. 先单独提交任务 JSON，使工作区恢复干净。

进入任务 worktree 后，第一条开发命令必须是：

```powershell
& .\scripts\repo\task-context.ps1 -Mode auto
```

把它输出的短契约、任务 JSON、`context.required`、handoff 和实时 Git 状态视为本次
启动上下文。不要要求用户重复上传这些文件，也不要默认通读整个 `docs/` 或整个
仓库。

每次会话恢复、上下文压缩或机器重启后都先再次运行：

```powershell
& .\scripts\repo\task-context.ps1 -Mode auto
```

然后从现有差异、测试证据、integration_order 和 handoff 继续，不要推倒重来。

### 四、当前已经核实的断点

不要重新猜测这些问题；先用聚焦测试刻画，再修复：

1. 后端课程详情返回嵌套的 `assignment/courseVersion/units/studentProgress/
   existingSubmission/practiceReferences`，前端适配器仍读取旧的顶层字段；
2. 活动适配丢失 `instruction/content/resources/progress/attempt/
   practiceReference`；
3. 创建课程 submission 返回 `{ submission, resumed }`，前端却读取顶层 ID；
4. 后端活动保存 DTO 使用 `kind/value/completed/expectedProgressRevision`，
   前端仍发送 `attemptType/answer/isCorrect`；
5. 课程练习入口使用不存在的 `/student/practice/` 单数路由；
6. 创建课程练习 attempt 时没有同时传
   `assignmentId/submissionId/activityId`；
7. 提交后的课程返回依赖一个从未写入的
   `yuzan-course-practice-context:<attemptId>`；
8. 课程提交 revision 被前端硬编码；
9. 适配器把异常转换为类似成功的对象，可能展示假空状态；
10. 练习提交成功与课程完成回写之间缺少可重试的中断恢复。

第 4 和第 8 项属于下一条“普通课程与作业”闭环的已知债务。本任务只确保
submission ID/status/revision 被正确保留；除非普通活动保存或整门课程提交直接
阻断课程练习启动，不在本任务扩张修复它们。

### 五、实现顺序

严格按下面顺序推进。每一步先运行能最快证伪该步的最小测试，通过后再进入下一步。

#### 第 0 步：基线和运行环境

- 运行 preflight；
- 检查 Node 24、仓库 pnpm 版本、相关服务、端口、数据库和对象存储；
- 运行当前相关测试，记录改动前结果；
- development/test 数据不足时使用当前可重复 seed；
- 所有业务 ID 必须从登录和 API 响应动态发现，不能粘贴 seed UUID。

#### 第 1 步：契约刻画

新增聚焦测试覆盖：

- 当前课程详情嵌套响应；
- 当前 submission 响应和 revision；
- submission ID/status/revision 的适配；
- `practiceReference`；
- 课程上下文三个 ID 必须同时存在；
- definition/activity/submission/enrollment/school 匹配；
- 跨学校、跨学生和错误引用失败；
- create/resume 与 complete 的幂等性；
- adapter 的错误传播。

如果学生课程 API 尚未进入 OpenAPI，先建 CCR 并补齐 provider/consumer 契约；
不在前端另造字段。

#### 第 2 步：课程详情与启动状态

- 按当前后端 DTO 修复 adapter；
- 保留 submission ID、status、revision；
- 保留活动 content、progress、attempt、practiceReference；
- load/create/resume 失败时不得继续导航；
- auth、permission、not-found、offline 和 unavailable 显式失败；
- 不在本任务提交整门课程或修复全部普通活动；把它们留给
  `P0-STUDENT-COURSE-SUBMIT-001`。

#### 第 3 步：课程练习启动桥

- 从当前 activity 取得 `practiceDefinitionId`；
- 创建或恢复课程 submission；
- 调用：

  ```javascript
  createOrResumePractice(practiceDefinitionId, {
    assignmentId,
    submissionId,
    activityId
  })
  ```

- 使用响应中的动态 `attemptId`；
- 保存最小课程返回上下文；
- `returnTo` 只允许同源相对课程路径；
- 跳转到：

  ```text
  /student/practices/attempts/<attemptId>/prepare/
  ```

- 不创建第二个执行器。

#### 第 4 步：真实作答证据

- 用现有通用执行器完成至少一个口语题和一个书面题；
- 浏览器麦克风产生非空 Blob；
- 真实执行录音 init、upload、complete、item bind；
- 保存书面答案，刷新后从 API 恢复，再 finalize；
- 麦克风拒绝、上传失败、空音频和绑定失败不得显示完成；
- 正式验收禁止 `?demo=1`。

#### 第 5 步：提交、回写和恢复

- 真实提交 AssessmentSession；
- 对课程 attempt 调用 `completeCoursePractice`；
- 后端已允许 SUBMITTED、PROCESSING、COMPLETED attempt 回写课程，不必伪造最终分数；
- 回写成功后返回原课程并重新请求详情；
- 提交成功但回写失败时显示“已提交、课程进度待同步”，只重试幂等回写；
- 浏览器在两步间关闭后仍能恢复；
- 重复回写不生成重复 ActivityAttempt/ActivityProgress；
- processing、FAILED、NEEDS_REVIEW、provider unavailable 如实显示。

#### 第 6 步：真实验收

在同一次运行中记录动态链：

```text
schoolId
→ assignmentId
→ submissionId
→ activityId
→ practiceDefinitionId
→ attemptId
→ itemId
→ recordingId
```

必须完成：

- 相关 frontend/API 聚焦测试；
- 正向和越权负向测试；
- 失败回写后重试测试；
- 1440、1024、390 三种宽度浏览器检查；
- console error、page error、failed request 审计；
- API 与 DB 状态核对；
- 新浏览器上下文重新打开课程，确认服务端仍为 completed；
- evidence 中不保存 token、密钥、真实学生资料或原始敏感录音内容。

### 六、最小完成定义

只有全部满足才能把任务标为 `READY_FOR_REVIEW`：

- 课程和练习使用同一真实登录学生；
- 所有 ID 均来自动 API；
- 课程详情和活动数据不再因 adapter 丢失；
- submission ID/revision 正确；
- attempt 保存正确 `courseSubmissionId/courseActivityId`；
- 真实录音非空并绑定；
- 书面答案保存、刷新恢复、定稿；
- session 真正提交；
- 课程活动真实、幂等完成；
- 刷新或新浏览器上下文后仍完成；
- 失败和 provider 状态真实；
- 没有固定 ID、静态分数、假报告、假成功或 `demo=1` 证据；
- 每项 `minimal_tests` 都有实际 PASS 命令和结果；
- handoff 写清实现、证据、风险、限制和回滚。

最小测试的含义是“直接覆盖本次最高风险的最小反证集”，不是只跑 HTTP 200，也不
要求每个小改动都先跑无关全仓测试。

### 七、自主决策与停止条件

以下情况自行选择最小、可逆、可测试方案，不要询问用户：

- 函数命名、局部文件组织、测试夹具形态；
- 在现有模型和执行器范围内的实现细节；
- 加强错误提示、幂等和聚焦测试；
- 对已确认契约漂移的直接修复。

只有以下情况暂停并明确报告：

- 无法确认准确 base 或发现来源不明的并发改动；
- 必须改变产品方向、权限语义或数据解释；
- 必须做未授权的 Prisma schema/生产数据/外部系统变更；
- 需要真实密钥、生产权限或用户外部协调；
- 安全检查后仍缺少不可替代的运行依赖。

不要因为工作量大、测试慢或存在可修复错误就停止。遇到失败先定位、记录、修复并
重跑。

### 八、自审、提交和推送

完成实现和证据后：

1. 更新 task JSON 状态、`test_evidence` 和 handoff；
2. 检查全部差异只服务唯一用户结果；
3. 检查 changed paths、共享 owner、CCR、密钥和隐私；
4. 运行：

   ```powershell
   & .\scripts\repo\task-gate.ps1 -Mode review -TaskFile project-ops/tasks/active/P0-STUDENT-COURSE-PRACTICE-001.json
   ```

5. 只 add 任务白名单文件；
6. 提交：

   ```text
   feat(student): close course-linked practice loop
   ```

7. 运行：

   ```powershell
   & .\scripts\repo\task-gate.ps1 -Mode finish -TaskFile project-ops/tasks/active/P0-STUDENT-COURSE-PRACTICE-001.json
   ```

8. 若 task JSON 已授权推送：

   ```powershell
   git push -u origin task/p0-student-course-practice-001
   ```

9. 验证本地 HEAD、远端 branch HEAD 相同；
10. 验证：

    ```powershell
    git status --porcelain
    ```

    必须无输出。

不要自动合并 main，不要重写历史。最后报告：

- 用户现在能完成什么；
- 关键实现；
- 实际测试和浏览器/API/DB 证据；
- 真实限制；
- commit、远端 branch；
- Git 干净状态；
- 建议的下一个学生闭环。

---

## 使用说明

这份提示词只负责首个学生闭环。完成并集成验证后，再从
`project-ops/plans/P0-STUDENT-CLOSED-LOOPS.md` 实例化“普通课程与作业”任务，
不要在本目标中顺手扩张教师、管理或翻译功能。
