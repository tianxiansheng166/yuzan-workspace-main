# Backend V3.1 模型分工规则 V2

> 本文件将 `MODEL_ALLOCATION_POLICY_V2` 映射到 Backend V3.1 Wave 的五个任务。所有复杂任务拆分为：Trae 预检 → Codex 高价值实现 → Trae 收尾/集成。

## 总原则

| 阶段 | 负责模型 | 核心职责 |
|------|----------|----------|
| A：Preflight | Trae | 环境、分支、worktree、依赖、Prisma、基线测试、资料准备、allowed paths |
| B：Implementation | Codex | 复杂领域模型、并发、幂等、权限、多租户安全、AI provider、隐私设计、跨模块难题 |
| C：Completion | Trae | 常规 repository/controller、测试补齐、文档、全量测试、提交、push、集成 |

## 各任务分工映射

### b31-101 教学闭环（Trae-2 负责）

#### Codex 高价值候选

- Assignment 状态机与可见性规则（跨 class/student scope）；
- Submission 幂等提交与 MinIO 签名 URL 安全边界；
- Feedback 权限隔离（教师只能看自己学校学生的提交）。

#### Trae 预检清单

- worktree clean；
- base commit = `22e3e14`；
- `pnpm install` 完成；
- Prisma generated；
- PostgreSQL/MinIO 可达；
- 现有 `classes/assignments/learning/submissions/feedback` 目录结构盘点；
- 提供 allowed paths / protected paths。

#### Trae 收尾清单

- 常规 CRUD repository / service / controller；
- DTO、单元测试、API 测试、权限测试；
- schema/contract request（如需）；
- push 到 `task/b31-101-teaching-loop`；
- 通知 Trae-1 集成。

### b31-102 测评闭环（Trae-3 负责）

#### Codex 高价值候选

- AI 测评状态机与 provider 未接通时的真实状态返回；
- 语音测评 `SpeechJob` 异步流水线（音频质量检查 → AI 处理 → 人工复核）；
- 推荐引擎冲突检测与复测计划生成；
- 临时测评 token 的安全边界与过期策略。

#### Trae 预检清单

- 同 b31-101 通用项；
- 盘点 `assessment/speech/recommendations/reports/assessment` 目录；
- 确认 `ActivityAttempt` / `SpeechJobStatus` 枚举；
- 准备 AI provider 未接通的测试桩边界。

#### Trae 收尾清单

- 同 b31-101 通用项；
- 特别覆盖 provider unavailable、pending、running、failed 状态测试。

### b31-103 管理端治理（Trae-4 负责）

#### Codex 高价值候选

- 课程版本治理状态机（DRAFT → IN_REVIEW → CHANGES_REQUESTED → APPROVED → PUBLISHED → RETIRED）；
- 推荐规则冲突检测与优先级解析；
- 平台级/学校级 admin 权限层级；
- 隐私审计查询与敏感操作日志。

#### Trae 预检清单

- 同 b31-101 通用项；
- 盘点 `admin/curriculum-governance/product-plans/privacy/audit` 目录；
- 确认 `CourseVersionStatus` / `MembershipRole` 枚举；
- 准备 dashboard 聚合查询的性能边界。

#### Trae 收尾清单

- 同 b31-101 通用项；
- 特别覆盖角色权限矩阵测试、审计日志测试。

### b31-104 志愿者/工具/社区（Trae-5 负责）

#### Codex 高价值候选

- 志愿者资格状态机（未 QUALIFIED 不得领取服务任务）；
- 一对一帮扶敏感信息最小可见边界；
- MindGraph / 藏汉翻译的 provider 未接通真实状态；
- 社区内容审核状态机（DRAFT → PENDING_REVIEW → PUBLISHED → HIDDEN/REJECTED）；
- 公开申请限流与防垃圾。

#### Trae 预检清单

- 同 b31-101 通用项；
- 盘点 `volunteers/training/support-pairings/tools/translations/community/cooperation` 目录；
- 确认相关枚举与现有 IntegrationConfig 模式。

#### Trae 收尾清单

- 同 b31-101 通用项；
- 特别覆盖志愿者权限隔离、敏感信息不可见测试。

### b31-105 平台/Contracts/报表/离线（Trae-1 负责）

#### Codex 高价值候选

- Reporting 聚合视图与数据权限（不复制所有源数据到 JSON 大字段）；
- Offline sync 冲突处理与幂等 cursor；
- 共享 schema / contract 变更的跨任务影响评估；
- 多租户数据隔离在 reporting 中的统一实现。

#### Trae 预检清单

- 同 b31-101 通用项；
- 盘点 `shared/database/common`、`operations/offline/reporting`；
- 确认 `schema.prisma` 当前模型；
- 准备 contract lint / OpenAPI lint 命令。

#### Trae 收尾清单

- 同 b31-101 通用项；
- 维护总控文档、STATUS-BOARD、API-FREEZE、MIGRATION-ORDER；
- 执行跨任务集成。

## 派发给 Codex 的前置门禁

Trae 必须在每个 Codex 子任务前返回：

```text
CODEX_TASK_ENVIRONMENT_READY

task: <b31-xxx>
repo: D:\program\test_program\yuzanxinsheng\three\yuzan-next
worktree: D:\program\test_program\yuzanxinsheng\three\worktrees\b31-xxx
branch: task/b31-xxx-xxxxxx
base full commit: 22e3e1443bf82cf3d5b9b14c3de606126ece5e39
remote synchronized: yes
git clean: yes

Node: 24.18.0
pnpm: 10.13.1
Docker: running (Linux containers)
PostgreSQL: 127.0.0.1:55432
MinIO: 127.0.0.1:59000
Prisma generated: yes
env available: yes

install: done
typecheck baseline: <status>
build baseline: <status>
test baseline: <status>
known baseline failures: <list or none>

source materials: <paths>
reference images: <paths or none>
routes: <list>
business documents: <list>

allowed paths: <list>
protected paths: <list>
acceptance commands: <list>
```

只有返回 `READY` 后，才向 Codex 派发高价值实现任务。

## Codex 提示词模板

每个 Codex 任务提示词必须包含：

1. 真实业务目标；
2. 已准备好的 exact commit；
3. 明确难题或页面；
4. 图片/参考路径；
5. 允许修改范围；
6. 禁止修改范围；
7. 已知接口/状态；
8. 验收标准；
9. 视觉或安全标准；
10. 最终测试命令。

不得要求 Codex：

- “先全面扫描项目”
- “先检查所有分支”
- “先安装所有环境”
- “先生成完整审计报告”
- “先盘点全部历史任务”

## 状态看板更新

在 `STATUS-BOARD.md` 中，每个任务增加三列：

- Preflight：Trae
- Hard Problem：Codex
- Completion/Integration：Trae

由 Trae-1 统一维护。
