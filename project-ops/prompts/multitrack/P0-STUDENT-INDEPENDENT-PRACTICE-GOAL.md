# Goal：学生独立专项练习闭环

```text
你负责 P0-STUDENT-INDEPENDENT-PRACTICE-001。复用当前 PracticeDefinition、
AssessmentSession、Recording 和 frontend/assessment 通用执行器，不创建第二套
练习系统。

从权威控制 worktree 运行：
& D:/program/test_program/yuzanxinsheng/three/worktrees/p0-multitrack-integration-001/project-ops/scripts/resolve-multitrack-task.ps1 `
  -TaskId P0-STUDENT-INDEPENDENT-PRACTICE-001 -CreateWorktree
脚本必须确认控制 HEAD 等于 origin/integration/p0-multitrack-001，并从接受表解析
规划任务的完整 commit；不要直接使用移动的 planning remote ref。

branch: task/p0-student-independent-practice-001
worktree: D:/program/test_program/yuzanxinsheng/three/worktrees/p0-student-independent-practice-001

依赖是否满足只认 accepted-baselines 和远端 HEAD。先创建任务 JSON 元数据提交，再
运行 task-context.ps1 -Mode auto。

task JSON 的 context.required 固定为：
- project-ops/AI-DEVELOPMENT-CONTRACT.md
- project-ops/plans/P0-MULTITRACK-CLOSED-LOOPS.md
- frontend/assessment/assets/practice.js
- frontend/assessment/assets/app.js
- backend/api/src/modules/assessment/practice.service.ts
- backend/api/src/modules/assessment/practice.controller.ts

allowed_paths：
- frontend/assessment/**
- backend/api/src/modules/assessment/**
- backend/api/test/assessment/**
- project-ops/tasks/active/P0-STUDENT-INDEPENDENT-PRACTICE-001.json
- project-ops/handoffs/P0-STUDENT-INDEPENDENT-PRACTICE-001.md
- evidence/p0-student-independent-practice-001/**

不修改 OpenAPI、Prisma、frontend/assets/api-client.js 或 frontend/server.mjs。当前
API client 已有 list/detail/createOrResume/favorite，当前 server 已有
/student/practices 路由；若实际契约缺失就置 BLOCKED 给 contract owner，不在页面
复制全局 client。

唯一用户结果：
真实登录学生从 /student/practices 动态看到可见练习，筛选并打开详情，创建或恢复
一个不带 assignmentId/submissionId/activityId 的独立 attempt，完成至少一条真实
非空录音和一项书面答案，提交后在独立练习历史中可见；刷新和新浏览器上下文可恢复，
再次练习创建符合规则的新 attempt，课程 ActivityProgress 不发生变化。

必须覆盖：
- catalog loading/empty/error/permission/offline；
- 动态 definitionId/attemptId/itemId/recordingId；
- create/resume 幂等；
- 独立 attempt 拒绝伪造课程上下文；
- 真实 MediaRecorder、上传、绑定、书面保存/刷新/finalize；
- session submit 和真实 processing/NEEDS_REVIEW/unavailable；
- 收藏和历史只在当前学生范围；
- 跨学生/学校拒绝；
- 不污染课程 submission/progress；
- 1440/1024/390，新浏览器上下文，console/page/request/HTTP 审计。

提交可复跑浏览器与 DB 核验脚本。mock/unit tests 只能证明局部逻辑，正式完成还需要
live browser/API/DB。运行 focused tests、typecheck/build、task-gate review/finish。
提交并推送 task branch，核对 remote HEAD 与 Git clean，不合并。
```
