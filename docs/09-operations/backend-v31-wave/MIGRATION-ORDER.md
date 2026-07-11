# 迁移顺序

## 当前基线迁移状态

基线提交 `22e3e1443bf82cf3d5b9b14c3de606126ece5e39` 已包含的迁移覆盖：

- User / School / Membership / Session / SessionPair
- Campus / Class / Term / Enrollment
- Course / CourseVersion / CourseReview / Unit / Lesson / LearningActivity
- Resource / ActivityResource / ActivityProgress
- Assignment / AssignmentTarget / Submission / Feedback
- AudioAsset / Question / ActivityAttempt
- ContentPackage / SyncJob / SyncOperation
- AuditLog / Device

所有迁移已按依赖顺序生成，并且 `prisma migrate deploy` 在 PostgreSQL `127.0.0.1:55432` 上可成功应用。

## 新增迁移顺序规则

后续每个任务产生的 schema 变更，由 Trae-1 按以下顺序合并为新的 migration：

### Step 1：收集需求

各任务在实现前提交：

```text
docs/09-operations/backend-v31-change-requests/<task-id>-schema-request.md
```

### Step 2：依赖排序

Trae-1 按业务依赖排序：

1. `b31-101` 教学闭环：Class / Assignment / LearningActivity / Submission / Feedback 相关扩展
2. `b31-102` 测评闭环：Assessment / Question / ActivityAttempt / Recommendation 相关扩展
3. `b31-103` 管理端治理：Admin metadata / ProductPlan / Privacy / Audit 相关扩展
4. `b31-104` 志愿者工具：Volunteer / Training / SupportPairing / Translation / Community 相关扩展
5. `b31-105` 平台与报表：Reporting views / Offline / Operations 相关扩展

### Step 3：生成迁移

在 `infra/database/prisma` 目录执行：

```powershell
pnpm prisma migrate dev --name <descriptive-name>
```

命名规范：

```text
b31_101_add_assignment_submission_links
b31_102_add_assessment_dimensions
b31_103_add_product_plans
b31_104_add_volunteer_training
b31_105_add_reporting_views
```

### Step 4：验证迁移

```powershell
pnpm prisma migrate deploy
pnpm prisma generate
pnpm --filter @yuzan/api test
```

### Step 5：提交与通知

- 提交到 `task/b31-105-platform-contracts-reporting`
- 普通 push
- 更新 `STATUS-BOARD.md` 和 `API-FREEZE.md`
- 通知各任务 rebase

## b31-105 已生成的迁移

### 20260711062055_b31_105_add_reporting_offline_operations

新增枚举：
- `ReportType`: STUDENT_GROWTH, CLASS_SUMMARY, SCHOOL_OVERVIEW
- `ReportStatus`: PENDING, GENERATING, READY, FAILED
- `SyncBatchStatus`: ACCEPTED, DUPLICATE, CONFLICT, REJECTED, PERMISSION_CHANGED
- `SyncCursorEntityType` 新增值: REPORT

新增表：
- `Report`: 报表（学生成长/班级摘要/学校概览），包含 generatedAt、period、filters、dataCompleteness、providerDisclosure
- `OfflineContentPackage`: 离线内容包，含 manifest、version、checksum、byteSize、expiresAt
- `SyncBatch`: 同步批次，含 accepted/duplicate/conflict/rejected/permissionChanged 五种状态计数

索引：
- Report: (schoolId, type, status), (schoolId, periodStart, periodEnd), (enrollmentId), (classId)
- OfflineContentPackage: (schoolId, courseVersionId, version), (schoolId, expiresAt)
- SyncBatch: (schoolId, deviceId, status), (schoolId, createdAt), clientBatchId unique

已验证：migration deploy 成功于 PostgreSQL 127.0.0.1:55432/yuzan_dev

## 回滚策略

- 开发阶段：使用 `prisma migrate resolve --rolled-back <migration-name>` 或重建测试数据库；
- 生产阶段：必须为每个新增 migration 提供对应的 down migration；
- 已合并到 `integration/windows-backend-v31-base-20260711` 的 migration 不得修改，只能追加。

## 禁止事项

- 不得在已有 migration 文件中手动编辑 SQL 绕过 Prisma 校验；
- 不得删除已应用过的 migration；
- 不得为不同任务创建相互冲突的 migration；
- 不得在 migration 中插入业务数据或 fixture。
