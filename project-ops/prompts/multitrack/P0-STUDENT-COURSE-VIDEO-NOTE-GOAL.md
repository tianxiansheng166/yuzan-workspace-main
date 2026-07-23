# Goal：学生视频时间点笔记闭环

```text
你负责 P0-STUDENT-COURSE-VIDEO-NOTE-001。严格依赖
P0-STUDENT-COURSE-VIDEO-PROGRESS-001 被 Integration Lead 接受；没有真实视频
恢复能力就不开始笔记任务。

从权威控制 worktree 运行：
& D:/program/test_program/yuzanxinsheng/three/worktrees/p0-multitrack-integration-001/project-ops/scripts/resolve-multitrack-task.ps1 `
  -TaskId P0-STUDENT-COURSE-VIDEO-NOTE-001 -CreateWorktree
脚本只使用远端一致的 accepted Video Progress commit。

branch: task/p0-student-course-video-note-001
worktree: D:/program/test_program/yuzanxinsheng/three/worktrees/p0-student-course-video-note-001

先提交 task JSON/必要 CCR，再运行 task-context.ps1 -Mode auto。

task JSON 的 context.required 固定为：
- project-ops/AI-DEVELOPMENT-CONTRACT.md
- project-ops/plans/P0-MULTITRACK-CLOSED-LOOPS.md
- frontend/student/courses/course-detail/note-controller.js
- frontend/student/courses/course-detail/course-player-state.js
- backend/api/src/modules/student-courses/student-courses.service.ts
- packages/contracts/openapi/openapi.yaml

allowed_paths：
- frontend/student/courses/course-detail/course-api-adapter.js
- frontend/student/courses/course-detail/course-player-state.js
- frontend/student/courses/course-detail/note-controller.js
- frontend/student/courses/course-detail/index.html
- frontend/student/courses/course-detail/*.test.mjs
- backend/api/src/modules/student-courses/**
- backend/api/test/student-courses/**
- packages/contracts/openapi/openapi.yaml
- project-ops/requests/CCR-P0-STUDENT-COURSE-VIDEO-NOTE-001.md
- project-ops/tasks/active/P0-STUDENT-COURSE-VIDEO-NOTE-001.json
- project-ops/handoffs/P0-STUDENT-COURSE-VIDEO-NOTE-001.md
- evidence/p0-student-course-video-note-001/**

唯一结果：
学生在真实视频当前时间创建私人笔记；刷新和新浏览器上下文仍存在；点击笔记跳回
对应时间；可编辑和删除；两个页面的旧 revision 修改返回 409 并重新拉取服务端
版本；其他学生和学校不可读写。

复用现有 StudentActivityNote Prisma 模型和 CRUD，不新建第二套笔记。补齐 OpenAPI
中 videoTimestamp/revision/409，并保证前端不本地伪增 revision 后掩盖服务端失败。

正式 E2E 必须按顺序证明：
create → refresh → seek → edit/revision+1 → stale revision 409
→ reload current → delete → refresh 后消失。

记录动态 school/enrollment/assignment/activity/note ID，API/DB 行、时间点误差和
tenant/user 负向结果。执行 focused tests、contract validate、typecheck/build、
1440/1024/390、新上下文和错误审计。review/finish 后提交、推送，核对 remote HEAD
和 Git clean；不合并。
```
