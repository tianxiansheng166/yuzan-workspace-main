# Goal：藏汉翻译工具真实 provider、修订与审批闭环

```text
你负责 P0-TIBETAN-TRANSLATION-TOOL-001。当前 translation module 是 fail-closed
骨架，教师页面是损坏的视觉稿。必须继承已有 DTO/port/错误语义，不用固定译文或
fake repository 冒充真实翻译。

前置条件：
P0-AI-TOOL-CONTRACTS-001 已被 Integration Lead 接受。运行：
& D:/program/test_program/yuzanxinsheng/three/worktrees/p0-multitrack-integration-001/project-ops/scripts/resolve-multitrack-task.ps1 `
  -TaskId P0-TIBETAN-TRANSLATION-TOOL-001 -CreateWorktree
脚本从权威 accepted entry 解析完整 base 并核对远端；未满足就 BLOCKED，不猜 base。

创建或恢复：
branch: task/p0-tibetan-translation-tool-001
worktree: D:/program/test_program/yuzanxinsheng/three/worktrees/p0-tibetan-translation-tool-001

先提交 active task JSON 和 Prisma CCR，再运行 task-context.ps1 -Mode auto。

task JSON 的 context.required 固定为：
- project-ops/AI-DEVELOPMENT-CONTRACT.md
- project-ops/plans/P0-MULTITRACK-CLOSED-LOOPS.md
- packages/contracts/openapi/openapi.yaml
- backend/api/src/modules/translations/translations.service.ts
- backend/api/src/modules/translations/translations.module.ts
- frontend/teacher/translation/index.html

allowed_paths：
- backend/api/src/modules/translations/**
- backend/api/test/modules/translations/**
- backend/worker/src/translation/**
- backend/worker/test/translation/**
- backend/worker/src/main.ts
- frontend/teacher/translation/**
- infra/ai/translation/**
- infra/database/prisma/schema.prisma
- infra/database/prisma/migrations/*_add_translation_review/**
- project-ops/requests/CCR-P0-TIBETAN-TRANSLATION-TOOL-001.md
- project-ops/tasks/active/P0-TIBETAN-TRANSLATION-TOOL-001.json
- project-ops/handoffs/P0-TIBETAN-TRANSLATION-TOOL-001.md
- evidence/p0-tibetan-translation-tool-001/**

禁止修改 OpenAPI、公共 API client、课程页面、根依赖和其他 worker consumer。页面
使用当前 YuzanApi.request 和翻译目录内 gateway。发现共享契约漂移时 BLOCKED 给
contract owner。

唯一用户结果：
真实教师登录后，BO→ZH 和 ZH→BO 各创建一个真实持久化 Job；worker 调用合法配置
的真实 translation provider，得到非空 machineResult，页面明确标记 NEEDS_REVIEW；
教师修改 revisedResult 并保存 revision，随后 APPROVED；刷新和新浏览器上下文仍
能看到自己的历史、修订和批准状态。

必须修复：
- Job 增加 createdByUserId，listMyJobs 在 repository 层按用户过滤；
- 学生只能看自己的 Job；教师查看全校范围严格遵守冻结契约；
- source plaintext 不落普通字段，Base64 不算加密；使用环境管理密钥和认证加密，
  响应/日志/evidence 不泄露源文或密钥；
- Redis/持久化限流，不保留 no-op；
- provider adapter、超时、认证、quota、重试和 unavailable；
- machineResult 与人工 revisedResult 分离，provider 重试不能覆盖 APPROVED；
- revision 乐观并发、reviewedByUserId/reviewedAt；
- glossary version；
- 修复 script.js，移除写死的服务正常、进度和离线可用；
- 前后端字符上限、隐私/历史文案和真实数据保留行为一致。

真实 provider 凭据缺失、合同/数据出境未明确或 provider 不支持藏文时，任务如实
BLOCKED。mock provider 只能证明失败和契约路径，不能把任务标 READY_FOR_REVIEW。

最小证据：
- 动态 schoolId/userId/jobId；
- BO↔ZH 两个真实 Job 和非空结果；
- provider request id/model/version/latency，不含 secret；
- source 不以明文或 Base64 存储；
- NEEDS_REVIEW → 人工 revision → APPROVED；
- 旧 revision 409；
- 新上下文恢复；
- 跨用户/学校拒绝；
- unavailable Job 没有 resultText，页面不显示服务正常；
- Unicode 藏文、空白、同语言、上限、timeout/quota/auth；
- 1440/1024/390，console/page/request/HTTP 审计。

运行 repository/provider/API/worker/frontend tests、真实 PostgreSQL integration、
Prisma generate/validate/migration/rollback smoke、contract validate、
typecheck/build、task-gate review/finish。提交可复跑脚本和证据，推送后核对 remote
HEAD 与 Git clean；不合并。
```
