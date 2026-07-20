# B-测试基线报告

**任务编号**: P0-TEST-FOUNDATION-001
**执行日期**: 2026-07-20
**执行环境**: Node 24.18.0 / pnpm 10.13.1 / Vitest 3.2.7 / esbuild 0.28.1
**工作目录**: `D:\program\test_program\yuzanxinsheng\three\workers\p0-tests`

---

## 1. 最终统计

| 指标 | 数值 |
|------|------|
| **passed** | **836**（非 DB 单元测试） |
| **skipped** | **55**（DB 集成测试，无 DATABASE_URL 时条件跳过，标记为"未执行"） |
| **failed** | **0** |
| **test files** | **48** |
| **config files** | **27** vitest.config.ts |

> **说明**：55 项 skipped 是 DB 集成测试在无 DATABASE_URL 时通过 `describe.skipIf(!process.env.DATABASE_URL)` 条件跳过，属于"未执行"状态，不可计入"通过"。DB 套件中有 14 项在无 DATABASE_URL 环境下仍可运行并通过（environment 变量检查、redactConnectionString 等纯逻辑测试）。

## 2. 新增测试文件

本任务新增 **7 个测试/辅助文件**：

| # | 文件 | 测试数 | 覆盖场景 |
|---|------|--------|----------|
| 1 | `apps/api/test/assessment/assessment.service.spec.ts` | 28 | 正常创建、访问控制、跨校拒绝、状态机、幂等完成、录音绑定 |
| 2 | `apps/api/test/recordings/recordings.service.spec.ts` | 17 | 录音所有权绑定、幂等完成、跨校拒绝、状态验证 |
| 3 | `apps/api/test/speech-job/speech-job.service.spec.ts` | 9 | SpeechJob 状态更新、原子 retryCount 递增、触发处理 |
| 4 | `apps/api/test/reporting/reporting.service.spec.ts` | 9 | 报告查询、创建、跨校拒绝、角色控制 |
| 5 | `apps/api/test/reporting/error-sanitization.spec.ts` | 3 | 错误信息脱敏（2项）、错误码命名规范（1项） |
| 6 | `apps/worker/test/speech-job.consumer.spec.ts` | 8 | 正常消费、供应商超时、音质拒绝、对象不存在、API回写失败、内部密钥、最大重试 |
| 7 | `apps/api/test/helpers/fake-prisma.service.ts` | — | 共享 Proxy-based fake PrismaService 辅助工具 |

> **注意**：`organizations` 和 `volunteer-persistence-tenant` 为已有测试文件，不是本任务新增。

## 3. 逐套件测试结果

### 3.1 P0 核心新增测试（本任务创建）

| 套件 | passed | skipped | failed |
|------|--------|---------|--------|
| assessment.service.spec.ts | 28 | 0 | 0 |
| recordings.service.spec.ts | 17 | 0 | 0 |
| speech-job.service.spec.ts | 9 | 0 | 0 |
| reporting.service.spec.ts | 9 | 0 | 0 |
| error-sanitization.spec.ts | 3 | 0 | 0 |
| **API 小计** | **66** | **0** | **0** |
| speech-job.consumer.spec.ts (worker) | 8 | 0 | 0 |
| **Worker 小计** | **8** | **0** | **0** |
| **P0 新增总计** | **74** | **0** | **0** |

### 3.2 Worker 测试详情

| 测试 | 触发场景 | 验证方式 |
|------|----------|----------|
| 正常消费 | 全 5 步 API 成功 | fetchMock 调用次数 + X-Internal-Key |
| 供应商超时 | speech API 抛出 ECONNREFUSED | rejects.toThrow + markSpeechJobFailed 调用 |
| 音频质量拒绝 | speech API 返回 422 | rejects.toThrow("422") + body.status=FAILED |
| 对象不存在 | download URL API 返回 404 | rejects.toThrow("404") |
| API 回写失败 | updateSpeechJobResult 返回 500 | rejects.toThrow("500") |
| 内部密钥存在 | API_INTERNAL_KEY="my-secret-key" | 所有内部调用携带 header |
| 内部密钥缺失 | API_INTERNAL_KEY="" | 所有内部调用无 header |
| 最大重试 | 供应商抛出 Service unavailable | rejects.toThrow + body.errorCode=PROCESSING_FAILED |

### 3.3 已有模块测试（修复 config 后恢复）

| 套件 | passed | skipped | failed |
|------|--------|---------|--------|
| translations | 42 | 0 | 0 |
| training | 58 | 0 | 0 |
| tools | 47 | 0 | 0 |
| support-pairings | 42 | 0 | 0 |
| learning | 13 | 0 | 0 |
| submissions | 56 | 0 | 0 |
| assignments | 56 | 0 | 0 |
| volunteers | 47 | 0 | 0 |
| feedback | 20 | 0 | 0 |
| cooperation | 72 | 0 | 0 |
| community | 92 | 0 | 0 |
| admin | 46 | 0 | 0 |
| **小计** | **591** | **0** | **0** |

### 3.4 其他 API 测试

| 套件 | passed | skipped | failed |
|------|--------|---------|--------|
| auth | 52 | 0 | 0 |
| curriculum | 51 | 0 | 0 |
| identity | 2 | 0 | 0 |
| operations | 4 | 0 | 0 |
| offline | 5 | 0 | 0 |
| organizations | 41 | 0 | 0 |
| volunteer-persistence-tenant | 2 | 0 | 0 |
| **小计** | **157** | **0** | **0** |

### 3.5 DB 集成测试（无 DATABASE_URL 时条件跳过 — 标记为"未执行"）

| 套件 | passed | skipped | failed | 说明 |
|------|--------|---------|--------|------|
| bootstrap (environment + startup) | 3 | 3 | 0 | environment 测试通过；startup 需要 DB 跳过 |
| root (app-composition) | 0 | 6 | 0 | 需要 DB 连接，全部跳过 |
| database (database-runtime.integration) | 11 | 11 | 0 | 纯逻辑测试通过；实际 DB 查询跳过 |
| integration/identity (prisma-identity.repository) | 0 | 21 | 0 | 需要 DB 连接，全部跳过 |
| integration/curriculum (prisma-course-version.repository) | 0 | 14 | 0 | 需要 DB 连接，全部跳过 |
| **小计** | **14** | **55** | **0** | 55 项 skipped 标记为"未执行" |

> **条件跳过机制**：`describe.skipIf(!process.env.DATABASE_URL)` + `dotenv: false`。当 DATABASE_URL 存在时，这些测试将正常执行而非跳过。

## 4. 修改文件清单

### 4.1 新增 vitest.config.ts 文件（12 个：11 个 API + 1 个 Worker）

| 文件 | 说明 |
|------|------|
| `apps/api/test/modules/learning/vitest.config.ts` | 5 级路径 |
| `apps/api/test/modules/submissions/vitest.config.ts` | 5 级路径 |
| `apps/api/test/modules/assignments/vitest.config.ts` | 5 级路径 |
| `apps/api/test/modules/feedback/vitest.config.ts` | 5 级路径 |
| `apps/api/test/modules/admin/vitest.config.ts` | 5 级路径 |
| `apps/api/test/identity/vitest.config.ts` | 4 级路径 |
| `apps/api/test/bootstrap/vitest.config.ts` | 4 级路径 |
| `apps/api/test/root/vitest.config.ts` | 4 级路径 |
| `apps/api/test/integration/identity/vitest.config.ts` | 5 级路径 |
| `apps/api/test/integration/curriculum/vitest.config.ts` | 5 级路径 |
| `apps/api/test/vitest.config.ts` | 3 级路径（覆盖 volunteer-persistence-tenant） |
| `apps/worker/test/vitest.config.ts` | Worker 测试专用配置 |

### 4.2 修复的 vitest.config.ts 文件（12 个）

- `apps/api/test/modules/translations/vitest.config.ts` — 从 worktree 改为相对路径
- `apps/api/test/modules/training/vitest.config.ts` — 同上
- `apps/api/test/modules/tools/vitest.config.ts` — 同上
- `apps/api/test/modules/support-pairings/vitest.config.ts` — 同上
- `apps/api/test/modules/volunteers/vitest.config.ts` — 同上
- `apps/api/test/modules/cooperation/vitest.config.ts` — 同上
- `apps/api/test/modules/community/vitest.config.ts` — 完全重写（原缺 root/alias）
- `apps/api/test/auth/vitest.config.ts` — 路径从 `../../` 改为 `../../../../`
- `apps/api/test/curriculum/vitest.config.ts` — 同上
- `apps/api/test/operations/vitest.config.ts` — 同上
- `apps/api/test/offline/vitest.config.ts` — 同上
- `apps/api/test/database/vitest.config.ts` — 同上

### 4.3 源码最小 DI 调整（使测试可注入）

为 9 个服务添加 `@Inject(PrismaService)`，为 1 个服务添加 `@Inject(ConfigService)`。这些修改仅增加显式 DI 装饰器，不影响运行时行为——NestJS 在运行时通过类型元数据自动解析，仅在 Vitest 环境中因 esbuild 不发射 `design:paramtypes` 需要显式 `@Inject()`。

| 文件 | 修改内容 |
|------|----------|
| `apps/api/src/modules/assessment/assessment.service.ts` | +`@Inject(PrismaService)` |
| `apps/api/src/modules/recordings/recordings.service.ts` | +`@Inject(PrismaService)` |
| `apps/api/src/modules/speech-job/speech-job.service.ts` | +`@Inject(ConfigService)` |
| `apps/api/src/modules/reporting/reporting.service.ts` | +`@Inject(PrismaService)` |
| `apps/api/src/modules/classes/classes.service.ts` | +`@Inject(PrismaService)` |
| `apps/api/src/modules/identity/identity.service.ts` | +`@Inject(PrismaService)` |
| `apps/api/src/modules/learning/learning.service.ts` | +`@Inject(PrismaService)` |
| `apps/api/src/modules/operations/operations.service.ts` | +`@Inject(PrismaService)` + import Inject |
| `apps/api/src/modules/student-dashboard/student-dashboard.service.ts` | +`@Inject(PrismaService)` |
| `apps/api/src/modules/submissions/submissions.service.ts` | +`@Inject(PrismaService)` |

## 5. 测试真实性审计

| 审计项 | 结果 |
|--------|------|
| 新增 test.skip/describe.skip/it.skip | 不存在 |
| 批量删除断言 | 不存在 |
| 异常吞掉后直接通过 | 不存在 |
| 所有 mock 都返回成功导致负向测试失真 | 不存在（assessment 17 个 rejects.toThrow、recordings 12 个、worker 5 个、reporting 6 个） |
| Worker 8 项测试各自触发不同场景 | 已确认（8 个 it 块覆盖全部 8 个场景） |
| DB 测试仅在 DATABASE_URL 缺失时跳过 | 已确认（`skipIf(!hasDb)` + `dotenv: false`） |
| DATABASE_URL 存在时不 skip | 已确认（`hasDb = !!process.env.DATABASE_URL`，有值时 hasDb=true） |
| 55 项跳过标记为"未执行" | 已确认 |

## 6. 与 Track A（合同收敛）的依赖关系

- 本任务创建的测试依赖 `packages/contracts` 中的 DTO 和错误码定义
- Track A 修复了 53 个 OpenAPI 不兼容问题，创建了 31 个合同测试
- 两个 Track 的测试互不冲突，可并行运行
- **可能与 Track A 冲突的文件**：无。本任务仅修改测试文件和添加 `@Inject()` 装饰器，不涉及 OpenAPI、DTO、错误码或 Prisma schema

## 7. 关键技术决策

| 决策 | 原因 |
|------|------|
| 使用 `providers: [Service, {provide: Token, useValue: fake}]` 替代 `imports: [FeatureModule]` | NestJS DI 模块作用域导致导入模块时级联实例化所有 provider |
| 为 10 个服务添加 `@Inject()` | Vitest/esbuild 不发射 `design:paramtypes` 装饰器元数据 |
| 使用 Proxy-based fake PrismaService | 避免为每个测试手写完整的 prisma mock，支持按需拦截 |
| 每个 test 目录独立 vitest.config.ts | monorepo 下路径解析需要各自配置 root 和 resolve.alias |
| DB 测试使用 `describe.skipIf(!process.env.DATABASE_URL)` + `dotenv: false` | 确保无数据库时测试正确跳过而非失败 |

## 8. Phase 3 回归命令

```powershell
# 设置 Node 24
$env:PATH = "C:\Users\Administrator\AppData\Roaming\fnm\node-versions\v24.18.0\installation;" + $env:PATH
cd D:\program\test_program\yuzanxinsheng\three\workers\p0-tests

# API 全量非 DB 测试
pnpm --filter @yuzan/api exec vitest run --config test/assessment/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/recordings/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/speech-job/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/reporting/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/organizations/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/auth/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/curriculum/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/identity/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/operations/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/offline/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/bootstrap/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/root/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/database/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/modules/translations/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/modules/training/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/modules/tools/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/modules/support-pairings/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/modules/learning/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/modules/submissions/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/modules/assignments/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/modules/volunteers/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/modules/feedback/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/modules/cooperation/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/modules/community/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/modules/admin/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/integration/identity/vitest.config.ts
pnpm --filter @yuzan/api exec vitest run --config test/integration/curriculum/vitest.config.ts

# Worker 测试
pnpm --filter @yuzan/worker exec vitest run --config test/vitest.config.ts

# DB 集成测试（需设置 DATABASE_URL）
# $env:DATABASE_URL = "postgresql://user:pass@localhost:5432/yuzan_test"
# pnpm --filter @yuzan/api exec vitest run --config test/database/vitest.config.ts
# pnpm --filter @yuzan/api exec vitest run --config test/integration/identity/vitest.config.ts
# pnpm --filter @yuzan/api exec vitest run --config test/integration/curriculum/vitest.config.ts
# pnpm --filter @yuzan/api exec vitest run --config test/bootstrap/vitest.config.ts
# pnpm --filter @yuzan/api exec vitest run --config test/root/vitest.config.ts
```

---

**报告生成时间**: 2026-07-20 23:30 CST
