# Goal：学生课程真实视频播放与服务端进度闭环

```text
你负责 P0-STUDENT-COURSE-VIDEO-PROGRESS-001。

前置条件：
- P0-STUDENT-COURSE-SUBMIT-001 已被真实验收并由 Integration Lead 接受；
- P0-AI-TOOL-CONTRACTS-001 已释放 OpenAPI 写锁；
- 当前没有任务修改课程核心文件。

运行：
& D:/program/test_program/yuzanxinsheng/three/worktrees/p0-multitrack-integration-001/project-ops/scripts/resolve-multitrack-task.ps1 `
  -TaskId P0-STUDENT-COURSE-VIDEO-PROGRESS-001 -CreateWorktree
base 必须是 registry 登记的 integration checkpoint，并逐项证明接受的 Course Submit
和 AI Contracts commit 都是其祖先；不得选择其中一个父分支。

创建或恢复：
branch: task/p0-student-course-video-progress-001
worktree: D:/program/test_program/yuzanxinsheng/three/worktrees/p0-student-course-video-progress-001

先提交 task JSON 和 OpenAPI CCR，再运行 task-context.ps1 -Mode auto。

task JSON 的 context.required 固定为：
- project-ops/AI-DEVELOPMENT-CONTRACT.md
- project-ops/plans/P0-MULTITRACK-CLOSED-LOOPS.md
- frontend/student/courses/course-detail/course-api-adapter.js
- frontend/student/courses/course-detail/media-controller.js
- backend/api/src/modules/student-courses/student-courses.service.ts
- packages/contracts/openapi/openapi.yaml

allowed_paths：
- frontend/student/courses/course-detail/course-api-adapter.js
- frontend/student/courses/course-detail/course-player-state.js
- frontend/student/courses/course-detail/media-controller.js
- frontend/student/courses/course-detail/index.html
- frontend/student/courses/course-detail/*.test.mjs
- backend/api/src/modules/student-courses/**
- backend/api/test/student-courses/**
- backend/api/test/resources/**
- packages/contracts/openapi/openapi.yaml
- project-ops/requests/CCR-P0-STUDENT-COURSE-VIDEO-PROGRESS-001.md
- project-ops/tasks/active/P0-STUDENT-COURSE-VIDEO-PROGRESS-001.json
- project-ops/handoffs/P0-STUDENT-COURSE-VIDEO-PROGRESS-001.md
- evidence/p0-student-course-video-progress-001/**

Resources provider 只读复用；发现权限缺陷再申请扩展，不顺手改。不要修改共享 seed，
验收数据使用 development/test-only 可重复 bootstrap。

唯一结果：
真实登录学生打开真实 VIDEO Activity，从课程绑定 Resource 动态取得短期签名播放
URL；HTMLVideoElement 实际加载并播放，中途进度写入服务端；刷新和新登录恢复到
合理误差范围；自然播放结束后 ActivityProgress completed=true，服务端课程百分比
真实增加。

已知缺口：
- 课程详情只给资源元数据，前端却读取不存在的 a.videoUrl/a.posterUrl；
- 首次进入时 loadVideoForActivity 可能早于 MediaController 初始化；
- timeupdate 只写内存；
- setActivityCompleted 把 progress 对象改成数字；
- OpenAPI SaveCourseActivityAttemptRequest 漏 videoPosition。

必须证明：
- 动态 assignmentId/activityId/resourceId/submissionId；
- 对象存储真实视频 bytes > 0，签名 URL/token 不落 evidence；
- duration > 0，播放事件和 currentTime 真正前进；
- 中途 position/revision、刷新恢复误差；
- 禁止直接 currentTime=duration 或直接写 DB 冒充播放；
- DB ActivityAttempt/ActivityProgress position/revision/completed；
- 完成前后服务端课程百分比；
- 跨学校资源拒绝；
- 1440/1024/390 和 console/page/request/HTTP 审计。

运行页面测试、student-courses/resources tests、contract validate、typecheck/build、
真实浏览器/API/DB E2E、task-gate review/finish。提交、推送、核对 remote HEAD 和
Git clean，不合并。
```
