# Goal：冻结教师教案与藏汉翻译共享契约

```text
你负责 P0-AI-TOOL-CONTRACTS-001。只做共享契约，不实现 provider、数据库、worker
或页面。

先在 canonical 只读验证 Git 现场并保留未提交内容。权威控制面固定为
D:/program/test_program/yuzanxinsheng/three/worktrees/p0-multitrack-integration-001。
确认其 HEAD 等于 origin/integration/p0-multitrack-001 后运行：
& D:/program/test_program/yuzanxinsheng/three/worktrees/p0-multitrack-integration-001/project-ops/scripts/resolve-multitrack-task.ps1 `
  -TaskId P0-AI-TOOL-CONTRACTS-001 -CreateWorktree
脚本会从 accepted-baselines 解析规划任务的完整 commit；未接受或远端不一致会失败，
不得直接解析移动的 planning branch。若目标 branch/worktree 已存在则只恢复。

branch: task/p0-ai-tool-contracts-001
worktree: D:/program/test_program/yuzanxinsheng/three/worktrees/p0-ai-tool-contracts-001

先从模板创建 active task JSON 并单独提交。allowed_paths 只允许：
- packages/contracts/**
- project-ops/requests/CCR-P0-AI-TOOL-CONTRACTS-001.md
- project-ops/tasks/active/P0-AI-TOOL-CONTRACTS-001.json
- project-ops/handoffs/P0-AI-TOOL-CONTRACTS-001.md
- evidence/p0-ai-tool-contracts-001/**

shared owner 固定为 packages/contracts/openapi/openapi.yaml，并创建 CCR。第一条
开发命令运行 task-context.ps1 -Mode auto。

task JSON 的 context.required 固定为：
- project-ops/AI-DEVELOPMENT-CONTRACT.md
- project-ops/plans/P0-MULTITRACK-CLOSED-LOOPS.md
- backend/api/src/modules/ai-lesson-planning/ai-lesson-planning.controller.ts
- backend/api/src/modules/ai-lesson-planning/dto/lesson-plan-job.response.ts
- backend/api/src/modules/translations/translations.controller.ts
- backend/api/src/modules/translations/domain/translation.types.ts

唯一结果：
OpenAPI 成为教师教案和翻译工具的共同 provider/consumer 事实，不再靠 controller、
前端 mock 和旧 readiness 文档分别猜字段。

先用 characterization tests 刻画当前教师 controller/DTO/response，再冻结：
- lesson plan Job create/get/cancel；
- draft list/get/update/approve；
- workflow status；
- lessonPlanDraftId 的唯一字段名；
- Job、Draft、Revision、provider unavailable、timeout、schema invalid；
- expectedRevision 冲突和敏感字段不可见。

再为翻译工具冻结最小契约：
- create/list own/get Job；
- createdByUserId 只作服务端归属，不向其他用户泄露；
- BO/ZH 双向、source hash、状态与安全错误；
- machineResult、revisedResult、reviewStatus、revision；
- 人工修订和 approve/reject；
- glossary version；
- provider not configured/unavailable/timeout/quota；
- source plaintext/encrypted payload/provider secret 永不出现在响应。

必须明确学生只能看自己的 Job；教师看全校任务是否允许以现有产品权限写清，不得
留“以后 repository 过滤”。同语言、空白、超长和 Unicode 藏文输入有契约。

不得修改 backend/frontend 实现来迁就验证。发现实现漂移时写入 handoff，交给后续
consumer/provider 任务。

最小验证：
- OpenAPI parser/validator；
- operationId 唯一；
- schema/ref/response code；
- provider DTO 与前端预期的静态契约测试；
- git diff --check；
- task-gate review/finish。

完成后提交、推送 task branch，核对 remote HEAD 和 Git clean，不合并。最终报告
冻结的字段/状态、发现的实现漂移、分支/commit、实际测试。
```
