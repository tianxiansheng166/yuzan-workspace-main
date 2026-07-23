# Goal：教师 AI 教案真实生成、修改与确认闭环

```text
你负责 P0-TEACHER-AI-LESSON-PLAN-001。已有代码是半成品，必须继承修复，不从零
重写，也不把 mock 测试当 live 证据。

前置条件：
P0-AI-TOOL-CONTRACTS-001 已被 Integration Lead 接受，且其远端 branch、commit、
handoff 可解析。未满足就记录 BLOCKED，不猜 base。

从权威控制 worktree 运行：
& D:/program/test_program/yuzanxinsheng/three/worktrees/p0-multitrack-integration-001/project-ops/scripts/resolve-multitrack-task.ps1 `
  -TaskId P0-TEACHER-AI-LESSON-PLAN-001 -CreateWorktree
脚本从 accepted entry 解析完整 base，并校验 accepted commit 等于远端任务 HEAD。

branch: task/p0-teacher-ai-lesson-plan-001
worktree: D:/program/test_program/yuzanxinsheng/three/worktrees/p0-teacher-ai-lesson-plan-001

先提交 active task JSON，再运行 task-context.ps1 -Mode auto。

task JSON 的 context.required 固定为：
- project-ops/AI-DEVELOPMENT-CONTRACT.md
- project-ops/plans/P0-MULTITRACK-CLOSED-LOOPS.md
- backend/api/src/modules/ai-lesson-planning/ai-lesson-planning.service.ts
- backend/worker/src/ai-generation/ai-generation.consumer.ts
- frontend/teacher/ai-tools/app.js
- infra/ai/flowise/schemas/lesson-plan-output.schema.json

allowed_paths：
- frontend/teacher/ai-tools/**
- backend/api/src/modules/ai-lesson-planning/**
- backend/api/test/ai-lesson-planning/**
- backend/worker/src/ai-generation/**
- backend/worker/test/ai-generation/**
- infra/ai/flowise/**
- project-ops/tasks/active/P0-TEACHER-AI-LESSON-PLAN-001.json
- project-ops/handoffs/P0-TEACHER-AI-LESSON-PLAN-001.md
- evidence/p0-teacher-ai-lesson-plan-001/**

禁止修改 Prisma、OpenAPI、frontend/assets/api-client.js、backend/worker/src/main.ts、
根依赖或全局路由。确需修改时先 BLOCKED/CCR，不越权扩白名单。

唯一用户结果：
真实教师选择本校一门已发布课程，输入教学目标，创建幂等 Job；BullMQ 调用真实
Flowise 和真实 AI provider，产出符合 versioned JSON Schema 的教案草稿；教师能
完整查看结构、修改并保存 revision，再确认 APPROVED；刷新和新浏览器上下文仍能
打开同一草稿，确认后只读。

先用测试锁定并修复已知硬缺口：
1. 后端 lessonPlanDraftId 与前端 draftId 错位；
2. 前端 classFlow/differentiatedSupport/exerciseDraft/teacherChecklist 与真实
   lessonFlow/differentiation/practiceDraft/teacherReviewChecklist 错位；
3. 对象数组被 [object Object]、保存丢 schemaVersion/context；
4. Flowise 模型节点没有运行时 credential/base path；
5. bootstrap flow ID、Worker FLOWISE_FLOW_ID、数据库 externalFlowId 没有单一来源；
6. API 只凭 URL/Queue 对象误报 Flowise/worker 可用；
7. worker 回写非 2xx/网络失败被吞掉，Job 永久卡住；
8. courseVersionId/lessonId 查询缺 school scope，异常被静默吞掉。

不得在 repo 或 evidence 写 provider 密钥。Flowise bootstrap 必须注入安全引用，不把
真实 secret 固化进 tracked flow JSON。资料上下文只宣称当前真实使用的课程/课时
字段；没有检索库就不要宣传 RAG 或大量资料库。

最小实验证据：
- 动态 schoolId/courseVersionId/jobId/draftId；
- 同一 idempotency key 返回同一 Job；
- QUEUED → RUNNING → SUCCEEDED；
- Flowise request、真实 provider request id、schema validation；
- Job input/output snapshot 非空；
- Draft 初始 NEEDS_REVIEW，revision 1=AI_GENERATION；
- 教师修改 revision 2=TEACHER_EDIT；
- 旧 revision 409；
- 确认 revision 3=TEACHER_APPROVE，状态 APPROVED；
- 刷新和新上下文仍存在且只读；
- 另一教师/学校不能读写；
- PROVIDER_NOT_CONFIGURED、PROVIDER_UNAVAILABLE、TIMEOUT、
  OUTPUT_SCHEMA_INVALID 都不生成假草稿或永久 QUEUED；
- 1440/1024/390，console/page/request/HTTP 审计。

提交 browser/api/database/flowise 结果 JSON、可复跑脚本和截图，但不保存密钥、
敏感 prompt 或真实学生数据。运行 API/worker/frontend focused tests、Flowise
closure tests、typecheck/build、task-gate review/finish。提交并推送，核对 remote
HEAD 和 Git clean；不合并 main/integration。
```
