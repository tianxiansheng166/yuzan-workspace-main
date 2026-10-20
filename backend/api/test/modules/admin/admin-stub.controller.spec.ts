import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { AdminCurriculumQueryDto, AdminStubController, ListSchoolsQueryDto } from "../../../src/modules/mvp-gaps/admin-stub.controller.js";
import { MembershipRole } from "../../../src/common/security/membership-role.js";
import { MembershipStatus, type Principal } from "../../../src/common/security/auth.types.js";
import type { PrismaService } from "../../../src/shared/database/prisma.service.js";
import type { StoragePort } from "../../../src/shared/storage/storage.port.js";

const schoolId = "11111111-1111-4111-8111-111111111111";
const otherSchoolId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";

type TestRecord = Record<string, unknown>;
type AsyncMock<Result> = Mock<(args?: TestRecord) => Promise<Result>>;
type AssessmentLinkCreate = (args: AssessmentLinkCreateArgs) => Promise<TestRecord>;
type Transaction = (callback: TransactionCallback) => Promise<unknown>;
type FakePrismaModel = {
  count: AsyncMock<number>;
  groupBy: AsyncMock<TestRecord[]>;
  findMany: AsyncMock<TestRecord[]>;
  findFirst: AsyncMock<TestRecord | null>;
  findUnique: AsyncMock<TestRecord | null>;
  create: AsyncMock<TestRecord>;
  createMany: AsyncMock<{ count: number }>;
  update: AsyncMock<TestRecord>;
  updateMany: AsyncMock<{ count: number }>;
  delete: AsyncMock<TestRecord>;
  deleteMany: AsyncMock<{ count: number }>;
};

type FakeAssessmentLinkModel = Omit<FakePrismaModel, "create"> & { create: AssessmentLinkCreateMock };
type AssessmentLinkCreateArgs = Parameters<PrismaService["assessmentLink"]["create"]>[0];
type AssessmentLinkCreateMock = Mock<AssessmentLinkCreate>;
type TransactionCallback = (transaction: FakePrisma) => Promise<unknown>;
type TransactionMock = Mock<Transaction>;
type DeleteObject = (objectKey: string) => Promise<void>;
type FakeStorage = StoragePort & { readonly deleteObjectMock: Mock<DeleteObject> };

type FakePrisma = {
  school: FakePrismaModel;
  membership: FakePrismaModel;
  user: FakePrismaModel;
  submission: FakePrismaModel;
  courseVersion: FakePrismaModel;
  assessmentSession: FakePrismaModel;
  assessmentReport: FakePrismaModel;
  assessmentItem: FakePrismaModel;
  sessionPair: FakePrismaModel;
  class: FakePrismaModel;
  enrollment: FakePrismaModel;
  assignment: FakePrismaModel;
  recording: FakePrismaModel;
  dataPolicyVersion: FakePrismaModel;
  privacyRetentionJob: FakePrismaModel;
  schoolImportJob: FakePrismaModel;
  assessmentLink: FakeAssessmentLinkModel;
  assessmentLinkAccess: FakePrismaModel;
  feedback: FakePrismaModel;
  privacyRequest: FakePrismaModel;
  productPlan: FakePrismaModel;
  planEntitlement: FakePrismaModel;
  schoolSubscription: FakePrismaModel;
  subscriptionEvent: FakePrismaModel;
  learningActivity: FakePrismaModel;
  question: FakePrismaModel;
  inviteCode: FakePrismaModel;
  auditLog: FakePrismaModel;
  $transaction: TransactionMock;
};

function asyncMock<Result>(): AsyncMock<Result> {
  return vi.fn<(args?: TestRecord) => Promise<Result>>();
}

function fakePrismaModel(): FakePrismaModel {
  return {
    count: asyncMock<number>(),
    groupBy: asyncMock<TestRecord[]>(),
    findMany: asyncMock<TestRecord[]>(),
    findFirst: asyncMock<TestRecord | null>(),
    findUnique: asyncMock<TestRecord | null>(),
    create: asyncMock<TestRecord>(),
    createMany: asyncMock<{ count: number }>(),
    update: asyncMock<TestRecord>(),
    updateMany: asyncMock<{ count: number }>(),
    delete: asyncMock<TestRecord>(),
    deleteMany: asyncMock<{ count: number }>(),
  };
}

function fakePrisma(): FakePrisma {
  const subscriptionEvent = fakePrismaModel();
  subscriptionEvent.findMany.mockResolvedValue([]);
  subscriptionEvent.findFirst.mockResolvedValue(null);

  return {
    school: fakePrismaModel(),
    membership: fakePrismaModel(),
    user: fakePrismaModel(),
    submission: fakePrismaModel(),
    courseVersion: fakePrismaModel(),
    assessmentSession: fakePrismaModel(),
    assessmentReport: fakePrismaModel(),
    assessmentItem: fakePrismaModel(),
    sessionPair: fakePrismaModel(),
    class: fakePrismaModel(),
    enrollment: fakePrismaModel(),
    assignment: fakePrismaModel(),
    recording: fakePrismaModel(),
    dataPolicyVersion: fakePrismaModel(),
    privacyRetentionJob: fakePrismaModel(),
    schoolImportJob: fakePrismaModel(),
    assessmentLink: {
      ...fakePrismaModel(),
      create: vi.fn<AssessmentLinkCreate>(),
    },
    assessmentLinkAccess: fakePrismaModel(),
    feedback: fakePrismaModel(),
    privacyRequest: fakePrismaModel(),
    productPlan: fakePrismaModel(),
    planEntitlement: fakePrismaModel(),
    schoolSubscription: fakePrismaModel(),
    subscriptionEvent,
    learningActivity: fakePrismaModel(),
    question: fakePrismaModel(),
    inviteCode: fakePrismaModel(),
    auditLog: fakePrismaModel(),
    $transaction: vi.fn<Transaction>(),
  };
}

function controllerFor(prisma: FakePrisma, storage?: StoragePort): AdminStubController {
  // The controller requires the concrete PrismaService class; this narrow test double implements only its exercised delegates.
  return new AdminStubController(prisma as unknown as PrismaService, storage);
}

function principalFor(role: MembershipRole): Principal {
  return { roles: [role], userId, membershipStatus: MembershipStatus.ACTIVE, source: "test" };
}

function fakeStorage(): FakeStorage {
  const deleteObjectMock = vi.fn<DeleteObject>().mockResolvedValue(undefined);
  return {
    putObject: vi.fn<StoragePort["putObject"]>().mockResolvedValue(undefined),
    generateUploadUrl: vi.fn<StoragePort["generateUploadUrl"]>().mockResolvedValue({ url: "https://storage.test/upload", objectKey: "test", expiresInSeconds: 60 }),
    generateDownloadUrl: vi.fn<StoragePort["generateDownloadUrl"]>().mockResolvedValue({ url: "https://storage.test/download", objectKey: "test", expiresInSeconds: 60 }),
    headObject: vi.fn<StoragePort["headObject"]>().mockResolvedValue({ exists: false }),
    deleteObject: deleteObjectMock,
    deleteObjectMock,
  };
}

function queryWithLimit<T extends { readonly limit: number }>(query: T, limit: number): T {
  Object.defineProperty(query, "limit", { value: limit });
  return query;
}

function lastCallArgs<Result>(mock: AsyncMock<Result>): TestRecord {
  const args = mock.mock.calls.at(-1)?.[0];
  if (!args) throw new Error("Expected Prisma mock to be called with query arguments");
  return args;
}

function useFakeTransaction(prisma: FakePrisma): void {
  prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
}

describe("AdminStubController persistence implementation", () => {
  it("scopes school-admin school reads to the current tenant", async () => {
    const prisma = fakePrisma();
    prisma.school.findFirst.mockResolvedValue(null);
    const controller = controllerFor(prisma);

    await expect(controller.getSchool(otherSchoolId, principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId })).rejects.toThrow("无权访问其他学校");
    expect(prisma.school.findFirst).not.toHaveBeenCalled();
  });

  it("normalizes school codes and writes an audit event", async () => {
    const prisma = fakePrisma();
    prisma.school.findUnique.mockResolvedValue(null);
    prisma.school.create.mockResolvedValue({ id: schoolId, code: "XZ-01", name: "拉萨学校" });
    const controller = controllerFor(prisma);

    const result = await controller.createSchool({ name: "拉萨学校", code: "xz-01" }, principalFor(MembershipRole.PLATFORM_ADMIN));

    expect(result.code).toBe("XZ-01");
    expect(lastCallArgs(prisma.school.create).data).toMatchObject({ code: "XZ-01" });
    expect(prisma.auditLog.create).toHaveBeenCalledOnce();
  });

  it("revokes invitations only inside the current tenant and is idempotent", async () => {
    const prisma = fakePrisma();
    prisma.inviteCode.findFirst.mockResolvedValue({ id: "invite-1", schoolId, revokedAt: null, usedCount: 0, maxUses: 1 });
    prisma.inviteCode.updateMany.mockResolvedValue({ count: 1 });
    const controller = controllerFor(prisma);
    const principal = principalFor(MembershipRole.SCHOOL_ADMIN);

    const result = await controller.revokeInvitation("invite-1", principal, { schoolId });

    expect(result.idempotent).toBe(false);
    expect(lastCallArgs(prisma.inviteCode.updateMany).where).toMatchObject({ id: "invite-1", revokedAt: null });
    prisma.inviteCode.findFirst.mockResolvedValue({ id: "invite-1", schoolId, revokedAt: new Date(), usedCount: 0, maxUses: 1 });
    const duplicate = await controller.revokeInvitation("invite-1", principal, { schoolId });
    expect(duplicate.idempotent).toBe(true);
  });

  it("returns tenant-scoped dashboard aggregates", async () => {
    const prisma = fakePrisma();
    for (const model of [prisma.school, prisma.membership, prisma.user, prisma.submission, prisma.courseVersion]) model.count.mockResolvedValue(1);
    prisma.membership.groupBy.mockResolvedValue([]);
    prisma.submission.groupBy.mockResolvedValue([]);
    const controller = controllerFor(prisma);

    const result = await controller.dashboard(principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId });

    expect(result.scope).toEqual({ schoolId });
    expect(result.metrics).toMatchObject({ schools: 1, users: 1, students: 1, teachers: 1, completedAssessments: 1, pendingReviews: 1 });
    expect(lastCallArgs(prisma.school.count).where).toMatchObject({ schoolId });
  });

  it("applies school list filters without escaping the tenant scope", async () => {
    const prisma = fakePrisma();
    prisma.school.findMany.mockResolvedValue([{ id: schoolId, code: "XZ-01", name: "拉萨学校", timezone: "Asia/Shanghai", regionCode: "LS", isActive: true, createdAt: new Date(), updatedAt: new Date(), _count: { memberships: 4, classes: 2 } }]);
    const controller = controllerFor(prisma);

    const query = queryWithLimit(Object.assign(new ListSchoolsQueryDto(), { search: "拉萨", regionCode: "LS", isActive: "true" }), 10);
    const result = await controller.listSchools(query, principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId });

    expect(result.items[0]).toMatchObject({ id: schoolId, counts: { memberships: 4, classes: 2 } });
    const schoolListArgs = lastCallArgs(prisma.school.findMany);
    expect(schoolListArgs.where).toMatchObject({ id: schoolId, deletedAt: null, regionCode: "LS", isActive: true, OR: [{ name: { contains: "拉萨" } }, { code: { contains: "拉萨" } }] });
    expect(schoolListArgs.take).toBe(10);
  });

  it("revokes sessions when a membership role or status changes", async () => {
    const prisma = fakePrisma();
    prisma.membership.findFirst.mockResolvedValue({ id: "44444444-4444-4444-8444-444444444444", userId, schoolId, role: MembershipRole.TEACHER, status: "ACTIVE", user: { id: userId, displayName: "教师" } });
    prisma.membership.update.mockResolvedValue({ id: "44444444-4444-4444-8444-444444444444", userId, schoolId, role: MembershipRole.TEACHER, status: "SUSPENDED" });
    useFakeTransaction(prisma);
    prisma.sessionPair.updateMany.mockResolvedValue({ count: 2 });
    const controller = controllerFor(prisma);

    await controller.updateMembership("44444444-4444-4444-8444-444444444444", { status: MembershipStatus.SUSPENDED }, principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId });

    expect(lastCallArgs(prisma.sessionPair.updateMany).where).toMatchObject({ userId, revokedAt: null });
  });

  it("returns a tenant-scoped user detail without credentials", async () => {
    const prisma = fakePrisma();
    const membershipId = "44444444-4444-4444-8444-444444444444";
    prisma.membership.findMany.mockResolvedValue([{ id: membershipId, userId, schoolId, role: MembershipRole.TEACHER, status: "ACTIVE", joinedAt: new Date("2026-01-01") }]);
    prisma.user.findFirst.mockResolvedValue({ id: userId, loginIdentifier: "teacher@example.com", displayName: "教师", preferredLocale: "zh-CN", status: "ACTIVE", createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-02") });
    prisma.school.findMany.mockResolvedValue([{ id: schoolId, code: "SCH-01", name: "测试学校" }]);
    prisma.sessionPair.count.mockResolvedValue(2);
    prisma.auditLog.findMany.mockResolvedValue([]);
    const controller = controllerFor(prisma);

    const result = await controller.getUser(userId, principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId });

    expect(result.user).not.toHaveProperty("passwordHash");
    expect(result.user).not.toHaveProperty("token");
    const firstMembership = result.memberships[0];
    expect(firstMembership).toBeDefined();
    if (!firstMembership) throw new Error("Expected a school membership");
    expect(firstMembership.school).toMatchObject({ id: schoolId, code: "SCH-01" });
    expect(lastCallArgs(prisma.membership.findMany).where).toMatchObject({ userId, schoolId });
    expect(lastCallArgs(prisma.auditLog.findMany).where).toMatchObject({ actorUserId: userId, schoolId });
  });

  it("does not disclose a user belonging only to another school", async () => {
    const prisma = fakePrisma();
    prisma.membership.findMany.mockResolvedValue([]);
    const controller = controllerFor(prisma);

    await expect(controller.getUser(userId, principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId })).rejects.toThrow("用户不存在或不在当前管理范围");
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it("returns tenant-scoped assessment overview aggregates", async () => {
    const prisma = fakePrisma();
    for (let attempt = 0; attempt < 6; attempt += 1) prisma.assessmentSession.count.mockResolvedValueOnce(1);
    prisma.assessmentReport.count.mockResolvedValue(2);
    prisma.assessmentItem.count.mockResolvedValue(3);
    const controller = controllerFor(prisma);

    const result = await controller.assessmentOverview(principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId });

    expect(result.scope).toEqual({ schoolId });
    expect(result.sessions).toEqual({ created: 1, inProgress: 1, submitted: 1, processing: 1, completed: 1, cancelled: 1 });
    expect(result.reports).toBe(2);
    expect(result.flaggedItems).toBe(3);
    expect(prisma.assessmentItem.count).toHaveBeenCalledWith({ where: { status: "FLAGGED", session: { schoolId } } });
  });

  it("creates a privacy export with safe fields and tenant-scoped evidence counts", async () => {
    const prisma = fakePrisma();
    prisma.membership.findMany.mockResolvedValue([{ id: "44444444-4444-4444-8444-444444444444", userId, schoolId, role: MembershipRole.STUDENT, status: "ACTIVE", joinedAt: new Date("2026-01-01") }]);
    prisma.user.findFirst.mockResolvedValue({ id: userId, loginIdentifier: "student@example.com", displayName: "学生", preferredLocale: "zh-CN", status: "ACTIVE", createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-02") });
    prisma.submission.count.mockResolvedValue(4);
    prisma.assessmentSession.count.mockResolvedValue(2);
    prisma.recording.count.mockResolvedValue(1);
    prisma.feedback.count.mockResolvedValue(3);
    const controller = controllerFor(prisma);

    const result = await controller.privacyExportUser(userId, principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId });

    expect(result.subject).not.toHaveProperty("passwordHash");
    expect(result.exclusions).toContain("rawRecordingContent");
    expect(result.learningEvidence).toEqual({ submissions: 4, assessments: 2, recordings: 1, feedback: 3 });
    expect(prisma.feedback.count).toHaveBeenCalledWith({ where: { schoolId, submission: { enrollment: { userId } } } });
    expect(prisma.auditLog.create).toHaveBeenCalledOnce();
  });

  it("creates and approves an export privacy request within the tenant", async () => {
    const prisma = fakePrisma();
    const requestId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    prisma.membership.findFirst.mockResolvedValue({ schoolId });
    prisma.privacyRequest.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: requestId, schoolId, subjectUserId: userId, type: "EXPORT", status: "PENDING" });
    prisma.privacyRequest.create.mockResolvedValue({ id: requestId, schoolId, subjectUserId: userId, requestedByUserId: userId, type: "EXPORT", status: "PENDING", reason: null, createdAt: new Date() });
    prisma.privacyRequest.update.mockResolvedValue({ id: requestId, schoolId, subjectUserId: userId, type: "EXPORT", status: "APPROVED", reviewedByUserId: userId, decisionComment: "允许导出", approvedAt: new Date(), completedAt: null, updatedAt: new Date() });
    const controller = controllerFor(prisma);

    const created = await controller.createPrivacyRequest({ subjectUserId: userId, type: "EXPORT" }, principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId });
    const approved = await controller.decidePrivacyRequest(requestId, { decision: "APPROVE", comment: "允许导出" }, principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId });

    expect(created.status).toBe("PENDING");
    expect(approved.status).toBe("APPROVED");
    expect(lastCallArgs(prisma.privacyRequest.create).data).toMatchObject({ schoolId, subjectUserId: userId, type: "EXPORT" });
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
  });

  it("requires platform approval for delete and freeze privacy requests", async () => {
    const prisma = fakePrisma();
    const requestId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    prisma.privacyRequest.findFirst.mockResolvedValue({ id: requestId, schoolId, subjectUserId: userId, type: "DELETE", status: "PENDING" });
    const controller = controllerFor(prisma);

    await expect(controller.decidePrivacyRequest(requestId, { decision: "APPROVE" }, principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId })).rejects.toThrow("平台管理员审批");
    expect(prisma.privacyRequest.update).not.toHaveBeenCalled();
  });

  it("executes an approved freeze by suspending the account and revoking sessions", async () => {
    const prisma = fakePrisma();
    const requestId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    prisma.privacyRequest.findFirst.mockResolvedValue({ id: requestId, schoolId, subjectUserId: userId, type: "FREEZE", status: "APPROVED" });
    prisma.privacyRequest.update.mockResolvedValue({ id: requestId, schoolId, subjectUserId: userId, type: "FREEZE", status: "COMPLETED", completedAt: new Date() });
    useFakeTransaction(prisma);
    const controller = controllerFor(prisma);

    const result = await controller.executePrivacyRequest(requestId, principalFor(MembershipRole.PLATFORM_ADMIN));

    expect(result.status).toBe("COMPLETED");
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: userId }, data: { status: "SUSPENDED" } });
    expect(lastCallArgs(prisma.sessionPair.updateMany).where).toMatchObject({ userId, revokedAt: null });
    expect(lastCallArgs(prisma.membership.updateMany).data).toMatchObject({ status: "SUSPENDED" });
  });

  it("does not execute a pending privacy request", async () => {
    const prisma = fakePrisma();
    prisma.privacyRequest.findFirst.mockResolvedValue({ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", schoolId, subjectUserId: userId, type: "DELETE", status: "PENDING" });
    const controller = controllerFor(prisma);

    await expect(controller.executePrivacyRequest("dddddddd-dddd-4ddd-8ddd-dddddddddddd", principalFor(MembershipRole.PLATFORM_ADMIN))).rejects.toThrow("只有已批准");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("restores a completed freeze from its execution snapshot", async () => {
    const prisma = fakePrisma();
    const requestId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    prisma.privacyRequest.findFirst.mockResolvedValue({ id: requestId, schoolId, subjectUserId: userId, type: "FREEZE", status: "COMPLETED", executionSnapshot: [{ id: "44444444-4444-4444-8444-444444444444", status: "ACTIVE" }] });
    prisma.privacyRequest.update.mockResolvedValue({ id: requestId, schoolId, subjectUserId: userId, type: "FREEZE", status: "CANCELLED", revokedAt: new Date(), revokedByUserId: userId });
    useFakeTransaction(prisma);
    const controller = controllerFor(prisma);

    const result = await controller.revokePrivacyFreeze(requestId, principalFor(MembershipRole.PLATFORM_ADMIN));

    expect(result.status).toBe("CANCELLED");
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: userId }, data: { status: "ACTIVE" } });
    expect(prisma.membership.update).toHaveBeenCalledWith({ where: { id: "44444444-4444-4444-8444-444444444444" }, data: { status: "ACTIVE" } });
  });

  it("creates a product plan with unique entitlements and audit", async () => {
    const prisma = fakePrisma();
    prisma.productPlan.findUnique.mockResolvedValue(null);
    prisma.productPlan.create.mockResolvedValue({ id: "55555555-5555-4555-8555-555555555555", code: "BASIC", name: "基础版", version: 1, status: "DRAFT", priceCents: 0, currency: "CNY", trialDays: 14, metadata: null, createdAt: new Date(), updatedAt: new Date(), entitlements: [] });
    const controller = controllerFor(prisma);

    const result = await controller.createProductPlan({ code: " basic ", name: "基础版", trialDays: 14, entitlements: [{ key: "students", limitValue: 100 }] }, principalFor(MembershipRole.PLATFORM_ADMIN));

    expect(result.code).toBe("BASIC");
    expect(lastCallArgs(prisma.productPlan.create).data).toMatchObject({ code: "BASIC", entitlements: { create: [{ key: "students", limitValue: 100 }] } });
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("rejects a school subscription when the plan is not active", async () => {
    const prisma = fakePrisma();
    prisma.school.findFirst.mockResolvedValue({ id: schoolId });
    prisma.productPlan.findFirst.mockResolvedValue(null);
    const controller = controllerFor(prisma);

    await expect(controller.createSchoolSubscription(schoolId, { planId: "66666666-6666-4666-8666-666666666666", startsAt: "2026-07-18T00:00:00.000Z" }, principalFor(MembershipRole.PLATFORM_ADMIN))).rejects.toThrow("只能订阅已启用套餐");
  });

  it("returns real quota usage and null for an unknown entitlement", async () => {
    const prisma = fakePrisma();
    prisma.schoolSubscription.findFirst.mockResolvedValue({ id: "66666666-6666-4666-8666-666666666666", status: "ACTIVE", endsAt: null, plan: { id: "77777777-7777-4777-8777-777777777777", code: "BASIC", name: "基础版", entitlements: [{ key: "students", limitValue: 100, config: null }, { key: "ai_calls", limitValue: 10, config: null }] } });
    prisma.membership.count.mockResolvedValueOnce(25).mockResolvedValueOnce(4);
    prisma.submission.count.mockResolvedValue(12);
    prisma.recording.count.mockResolvedValue(8);
    const controller = controllerFor(prisma);

    const result = await controller.getSchoolQuotaUsage(schoolId, principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId });

    expect(result.items).toContainEqual({ key: "students", used: 25, limit: 100, remaining: 75, percent: 25 });
    expect(result.items.some((item) => item.key === "ai_calls" && item.used === null && item.remaining === null && item.percent === null)).toBe(true);
  });

  it("records quota usage events idempotently and validates the entitlement", async () => {
    const prisma = fakePrisma();
    const subscriptionId = "66666666-6666-4666-8666-666666666666";
    prisma.schoolSubscription.findFirst.mockResolvedValue({ id: subscriptionId, plan: { entitlements: [{ key: "ai_calls" }] } });
    prisma.subscriptionEvent.create.mockResolvedValue({ id: "event-1", subscriptionId, type: "QUOTA_USAGE_RECORDED", payload: { entitlementKey: "ai_calls", amount: 3, idempotencyKey: "job-1" }, createdAt: new Date() });
    const controller = controllerFor(prisma);
    const principal = principalFor(MembershipRole.PLATFORM_ADMIN);

    const result = await controller.recordQuotaUsageEvent(schoolId, { entitlementKey: "ai_calls", amount: 3, idempotencyKey: "job-1", sourceType: "ASSESSMENT" }, principal);

    expect(result.idempotent).toBe(false);
    expect(lastCallArgs(prisma.subscriptionEvent.create).data).toMatchObject({ type: "QUOTA_USAGE_RECORDED", payload: { amount: 3, idempotencyKey: "job-1" } });
    prisma.subscriptionEvent.findFirst.mockResolvedValue({ id: "event-1", payload: { idempotencyKey: "job-1" }, createdAt: new Date() });
    const duplicate = await controller.recordQuotaUsageEvent(schoolId, { entitlementKey: "ai_calls", amount: 3, idempotencyKey: "job-1" }, principal);
    expect(duplicate.idempotent).toBe(true);
    expect(prisma.subscriptionEvent.create).toHaveBeenCalledTimes(1);
  });

  it("renews an active subscription from its existing end date", async () => {
    const prisma = fakePrisma();
    const subscriptionId = "66666666-6666-4666-8666-666666666666";
    const existingEnd = new Date(Date.now() + 10 * 86400000);
    prisma.schoolSubscription.findUnique.mockResolvedValue({ id: subscriptionId, schoolId, status: "ACTIVE", endsAt: existingEnd });
    prisma.schoolSubscription.update.mockResolvedValue({ id: subscriptionId, schoolId, status: "ACTIVE", endsAt: new Date(existingEnd.getTime() + 30 * 86400000), autoRenew: false });
    useFakeTransaction(prisma);
    const controller = controllerFor(prisma);

    const result = await controller.renewSubscription(subscriptionId, { days: 30, reason: "续期" }, principalFor(MembershipRole.PLATFORM_ADMIN));

    expect(result.status).toBe("ACTIVE");
    expect(lastCallArgs(prisma.subscriptionEvent.create).data).toMatchObject({ subscriptionId, type: "RENEWED" });
  });

  it("activates one data policy version and retires the previous active version", async () => {
    const prisma = fakePrisma();
    const policyId = "77777777-7777-4777-8777-777777777777";
    prisma.dataPolicyVersion.findUnique.mockResolvedValue({ id: policyId, resourceType: "RECORDING", status: "DRAFT" });
    prisma.dataPolicyVersion.update.mockResolvedValue({ id: policyId, name: "录音保留", version: 2, resourceType: "RECORDING", retentionDays: 180, status: "ACTIVE", updatedAt: new Date() });
    useFakeTransaction(prisma);
    const controller = controllerFor(prisma);

    const result = await controller.activateDataPolicy(policyId, principalFor(MembershipRole.PLATFORM_ADMIN));

    expect(result.status).toBe("ACTIVE");
    const policyUpdateArgs = lastCallArgs(prisma.dataPolicyVersion.updateMany);
    expect(policyUpdateArgs.where).toMatchObject({ resourceType: "RECORDING", status: "ACTIVE" });
    expect(policyUpdateArgs.data).toMatchObject({ status: "RETIRED" });
  });

  it("runs retention in dry-run mode and never redacts recordings", async () => {
    const prisma = fakePrisma();
    const jobId = "88888888-8888-4888-8888-888888888888";
    const cutoffAt = new Date("2026-01-01T00:00:00.000Z");
    prisma.privacyRetentionJob.findUnique.mockResolvedValue({ id: jobId, policyId: "77777777-7777-4777-8777-777777777777", schoolId, cutoffAt, status: "QUEUED", dryRun: true });
    prisma.recording.findMany.mockResolvedValue([{ id: "recording-1", objectKey: "recordings/1", chunks: [] }, { id: "recording-2", objectKey: "recordings/2", chunks: [] }, { id: "recording-3", objectKey: "recordings/3", chunks: [] }, { id: "recording-4", objectKey: "recordings/4", chunks: [] }]);
    prisma.privacyRetentionJob.update.mockResolvedValue({ id: jobId, policyId: "77777777-7777-4777-8777-777777777777", schoolId, cutoffAt, status: "COMPLETED", dryRun: true, scannedCount: 4, redactedCount: 0, startedAt: new Date(), completedAt: new Date() });
    const controller = controllerFor(prisma);

    const result = await controller.runRetentionJob(jobId, principalFor(MembershipRole.PLATFORM_ADMIN));

    expect(result.execution).toBe("DRY_RUN_ONLY");
    expect(result.redactedCount).toBe(0);
    expect(lastCallArgs(prisma.recording.findMany).where).toMatchObject({ schoolId, objectKey: { not: null } });
  });

  it("deletes expired objects only with an explicit storage adapter and retains database evidence", async () => {
    const prisma = fakePrisma();
    const jobId = "88888888-8888-4888-8888-888888888888";
    const cutoffAt = new Date("2026-01-01T00:00:00.000Z");
    prisma.privacyRetentionJob.findUnique.mockResolvedValue({ id: jobId, policyId: "77777777-7777-4777-8777-777777777777", schoolId, cutoffAt, status: "QUEUED", dryRun: false });
    prisma.recording.findMany.mockResolvedValue([{ id: "recording-1", objectKey: "recordings/1", chunks: [{ objectKey: "recordings/1/part-1" }] }]);
    prisma.privacyRetentionJob.update.mockResolvedValue({ id: jobId, policyId: "77777777-7777-4777-8777-777777777777", schoolId, cutoffAt, status: "COMPLETED", dryRun: false, scannedCount: 1, redactedCount: 1, startedAt: new Date(), completedAt: new Date() });
    const storage = fakeStorage();
    const controller = controllerFor(prisma, storage);

    const result = await controller.runRetentionJob(jobId, principalFor(MembershipRole.PLATFORM_ADMIN));

    expect(result.execution).toBe("OBJECTS_DELETED_METADATA_RETAINED");
    expect(storage.deleteObjectMock).toHaveBeenCalledTimes(2);
    expect(lastCallArgs(prisma.privacyRetentionJob.update).data).toMatchObject({ redactedCount: 1, status: "COMPLETED" });
  });

  it("imports schools idempotently and records row-level duplicate errors", async () => {
    const prisma = fakePrisma();
    prisma.schoolImportJob.findUnique.mockResolvedValue(null);
    prisma.schoolImportJob.create.mockResolvedValue({ id: "99999999-9999-4999-8999-999999999999", fileHash: "a".repeat(16), status: "PROCESSING", rowCount: 2 });
    prisma.school.findMany.mockResolvedValue([]);
    prisma.school.createMany.mockResolvedValue({ count: 1 });
    prisma.schoolImportJob.update.mockResolvedValue({ id: "99999999-9999-4999-8999-999999999999", fileHash: "a".repeat(16), status: "COMPLETED", rowCount: 2, successCount: 1, errorCount: 1, rowErrors: [{ row: 2, message: "文件内编码重复" }], completedAt: new Date() });
    const controller = controllerFor(prisma);

    const result = await controller.importSchools({ fileHash: "A".repeat(16), rows: [{ name: "学校一", code: "xz-01" }, { name: "学校一重复", code: "XZ-01" }] }, principalFor(MembershipRole.PLATFORM_ADMIN));

    expect(result.idempotent).toBe(false);
    if (result.idempotent || !("successCount" in result.job) || !("errorCount" in result.job)) {
      throw new Error("Expected a newly processed import job with row counts");
    }
    expect(result.job.successCount).toBe(1);
    expect(result.job.errorCount).toBe(1);
    expect(prisma.school.createMany).toHaveBeenCalledWith({ data: [{ code: "XZ-01", name: "学校一", timezone: "Asia/Shanghai" }] });
  });

  it("can queue a school import payload for an explicit later run", async () => {
    const prisma = fakePrisma();
    prisma.schoolImportJob.findUnique.mockResolvedValue(null);
    prisma.schoolImportJob.create.mockResolvedValue({ id: "async-job", fileHash: "b".repeat(16), status: "QUEUED", rowCount: 1 });
    const controller = controllerFor(prisma);

    const result = await controller.importSchools({ fileHash: "B".repeat(16), async: true, rows: [{ name: "异步学校", code: "ASYNC-01" }] }, principalFor(MembershipRole.PLATFORM_ADMIN));

    expect(result.queued).toBe(true);
    expect(lastCallArgs(prisma.schoolImportJob.create).data).toMatchObject({ status: "QUEUED", payload: [{ name: "异步学校", code: "ASYNC-01" }] });
  });

  it("creates an assessment link without persisting the plaintext token", async () => {
    const prisma = fakePrisma();
    prisma.school.findFirst.mockResolvedValue({ id: schoolId });
    prisma.class.findFirst.mockResolvedValue({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    prisma.assessmentLink.create.mockImplementation(({ data }) => Promise.resolve({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", ...data, tokenPreview: data.tokenPreview, status: "ACTIVE", usedCount: 0, createdAt: new Date() }));
    const controller = controllerFor(prisma);

    const result = await controller.createAssessmentLink({ schoolId, assessmentKey: "reading-v1", title: "朗读测评", targetType: "CLASS", targetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", expiresAt: "2026-12-31T00:00:00.000Z", maxUses: 20 }, principalFor(MembershipRole.PLATFORM_ADMIN), { schoolId });

    expect(result.token).toBeTruthy();
    const createCall = prisma.assessmentLink.create.mock.calls.at(0);
    expect(createCall).toBeDefined();
    if (!createCall) throw new Error("Assessment link was not persisted");
    expect(createCall[0].data).not.toHaveProperty("token");
    expect(createCall[0].data.tokenHash).not.toBe(result.token);
  });

  it("prevents a school administrator from revoking a link in another school", async () => {
    const prisma = fakePrisma();
    prisma.assessmentLink.findFirst.mockResolvedValue(null);
    const controller = controllerFor(prisma);

    await expect(controller.revokeAssessmentLink("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId })).rejects.toThrow("不存在或不在当前管理范围");
  });

  it("lists curriculum versions with content counts inside the tenant", async () => {
    const prisma = fakePrisma();
    prisma.courseVersion.findMany.mockResolvedValue([{ id: "55555555-5555-4555-8555-555555555555", schoolId, courseId: "66666666-6666-4666-8666-666666666666", version: 2, status: "IN_REVIEW", title: "高原阅读", description: null, gradeBand: "小学", locale: "zh-CN", submittedAt: null, approvedAt: null, publishedAt: null, updatedAt: new Date(), course: { stableKey: "plateau-reading" }, _count: { units: 3, assignments: 2, reviews: 1 } }]);
    const controller = controllerFor(prisma);

    const query = queryWithLimit(Object.assign(new AdminCurriculumQueryDto(), { search: "高原", status: "IN_REVIEW" }), 20);
    const result = await controller.listCurriculum(query, principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId });

    expect(result.scope).toEqual({ schoolId });
    const firstItem = result.items[0];
    expect(firstItem).toBeDefined();
    if (!firstItem) throw new Error("Expected one curriculum version");
    expect(firstItem._count).toEqual({ units: 3, assignments: 2, reviews: 1 });
    expect(lastCallArgs(prisma.courseVersion.findMany).where).toMatchObject({ schoolId, status: "IN_REVIEW", OR: [{ title: { contains: "高原" } }, { course: { stableKey: { contains: "高原" } } }] });
  });

  it("updates only editable curriculum versions with optimistic concurrency", async () => {
    const prisma = fakePrisma();
    const updatedAt = new Date("2026-07-18T10:00:00.000Z");
    prisma.courseVersion.findFirst.mockResolvedValue({ id: "55555555-5555-4555-8555-555555555555", schoolId, status: "DRAFT", title: "旧标题", description: null, gradeBand: "小学", objectives: {}, updatedAt });
    prisma.courseVersion.update.mockResolvedValue({ id: "55555555-5555-4555-8555-555555555555", schoolId, status: "DRAFT", title: "新标题", description: "说明", gradeBand: "小学", objectives: {}, updatedAt: new Date() });
    const controller = controllerFor(prisma);

    const result = await controller.updateCurriculum("55555555-5555-4555-8555-555555555555", { title: "新标题", description: "说明", expectedUpdatedAt: updatedAt.toISOString() }, principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId });

    expect(result.title).toBe("新标题");
    expect(lastCallArgs(prisma.courseVersion.update).data).toMatchObject({ title: "新标题", description: "说明" });
    expect(prisma.auditLog.create).toHaveBeenCalledOnce();
  });

  it("publishes only approved curriculum versions", async () => {
    const prisma = fakePrisma();
    prisma.courseVersion.findFirst.mockResolvedValue({ id: "55555555-5555-4555-8555-555555555555", schoolId, status: "APPROVED", title: "高原阅读", version: 2 });
    prisma.courseVersion.update.mockResolvedValue({ id: "55555555-5555-4555-8555-555555555555", schoolId, status: "PUBLISHED", title: "高原阅读", version: 2, publishedAt: new Date() });
    const controller = controllerFor(prisma);

    const result = await controller.publishCurriculum("55555555-5555-4555-8555-555555555555", principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId });

    expect(result.status).toBe("PUBLISHED");
    expect(lastCallArgs(prisma.courseVersion.update).data).toMatchObject({ status: "PUBLISHED" });
  });

  it("creates a published curriculum assignment only for valid in-tenant targets", async () => {
    const prisma = fakePrisma();
    const versionId = "55555555-5555-4555-8555-555555555555";
    const classId = "77777777-7777-4777-8777-777777777777";
    const enrollmentId = "88888888-8888-4888-8888-888888888888";
    prisma.courseVersion.findFirst.mockResolvedValue({ id: versionId, schoolId, status: "PUBLISHED", title: "高原阅读" });
    prisma.class.findMany.mockResolvedValue([{ id: classId }]);
    prisma.enrollment.findMany.mockResolvedValue([{ id: enrollmentId }]);
    prisma.assignment.create.mockResolvedValue({ id: "99999999-9999-4999-8999-999999999999", schoolId, courseVersionId: versionId, title: "春季阅读任务", status: "DRAFT", startsAt: new Date(), dueAt: new Date(), offlineRequired: false, createdAt: new Date(), targets: [{ id: "a", targetType: "CLASS", classId, enrollmentId: null }, { id: "b", targetType: "STUDENT", classId: null, enrollmentId }] });
    const controller = controllerFor(prisma);

    const result = await controller.createCurriculumAssignment(versionId, { title: "春季阅读任务", startsAt: "2026-07-20T00:00:00.000Z", dueAt: "2026-07-30T00:00:00.000Z", targets: [{ targetType: "CLASS", classId }, { targetType: "STUDENT", enrollmentId }] }, principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId });

    expect(result.targets).toHaveLength(2);
    expect(lastCallArgs(prisma.assignment.create).data).toMatchObject({ schoolId, courseVersionId: versionId, targets: { create: [{ classId }, { enrollmentId }] } });
    expect(prisma.auditLog.create).toHaveBeenCalledOnce();
  });

  it("rejects curriculum assignments with cross-tenant or inactive targets", async () => {
    const prisma = fakePrisma();
    const versionId = "55555555-5555-4555-8555-555555555555";
    const foreignClassId = "77777777-7777-4777-8777-777777777777";
    prisma.courseVersion.findFirst.mockResolvedValue({ id: versionId, schoolId, status: "PUBLISHED", title: "高原阅读" });
    prisma.class.findMany.mockResolvedValue([]);
    prisma.enrollment.findMany.mockResolvedValue([]);
    const controller = controllerFor(prisma);

    await expect(controller.createCurriculumAssignment(versionId, { title: "越权任务", startsAt: "2026-07-20T00:00:00.000Z", dueAt: "2026-07-30T00:00:00.000Z", targets: [{ targetType: "CLASS", classId: foreignClassId }] }, principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId })).rejects.toThrow("不属于当前学校");
    expect(prisma.assignment.create).not.toHaveBeenCalled();
  });

  it("updates an activity only through its owning curriculum version", async () => {
    const prisma = fakePrisma();
    const versionId = "55555555-5555-4555-8555-555555555555";
    const activityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    prisma.courseVersion.findFirst.mockResolvedValue({ id: versionId, schoolId, status: "DRAFT" });
    prisma.learningActivity.update.mockResolvedValue({ id: activityId, lessonId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", type: "TEXT", title: "更新活动", required: true, instruction: {}, content: {}, sortOrder: 1 });
    const controller = controllerFor(prisma);

    const result = await controller.updateCurriculumActivity(versionId, activityId, { title: "更新活动", content: { body: "内容" } }, principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId });

    expect(result.title).toBe("更新活动");
    const versionQuery = lastCallArgs(prisma.courseVersion.findFirst).where;
    expect(versionQuery).toMatchObject({ id: versionId, schoolId });
    expect(versionQuery).toHaveProperty("units");
    expect(prisma.auditLog.create).toHaveBeenCalledOnce();
  });

  it("updates a question only through its owning curriculum version", async () => {
    const prisma = fakePrisma();
    const versionId = "55555555-5555-4555-8555-555555555555";
    const questionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    prisma.courseVersion.findFirst.mockResolvedValue({ id: versionId, schoolId, status: "CHANGES_REQUESTED" });
    prisma.question.update.mockResolvedValue({ id: questionId, activityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", kind: "CHOICE", prompt: { text: "新题目" }, answerKey: { value: "A" }, explanation: null, sortOrder: 1 });
    const controller = controllerFor(prisma);

    const result = await controller.updateCurriculumQuestion(versionId, questionId, { prompt: { text: "新题目" }, answerKey: { value: "A" } }, principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId });

    expect(result.kind).toBe("CHOICE");
    expect(lastCallArgs(prisma.question.update).where).toMatchObject({ id: questionId });
    expect(prisma.auditLog.create).toHaveBeenCalledOnce();
  });

  it("creates an activity and question only in an editable curriculum tree", async () => {
    const prisma = fakePrisma();
    const versionId = "55555555-5555-4555-8555-555555555555";
    const lessonId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const activityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    prisma.courseVersion.findFirst
      .mockResolvedValueOnce({ id: versionId, schoolId, status: "DRAFT" })
      .mockResolvedValueOnce({ id: versionId, schoolId, status: "DRAFT" });
    prisma.learningActivity.create.mockResolvedValue({ id: activityId, lessonId, type: "CHOICE", title: "新环节", required: true, instruction: null, content: {}, sortOrder: 2 });
    prisma.question.create.mockResolvedValue({ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", activityId, kind: "CHOICE", prompt: { text: "题目" }, answerKey: { value: "A" }, explanation: null, sortOrder: 0 });
    const controller = controllerFor(prisma);

    const activity = await controller.createCurriculumActivity(versionId, { lessonId, type: "CHOICE", title: "新环节", sortOrder: 2 }, principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId });
    const question = await controller.createCurriculumQuestion(versionId, activityId, { kind: "CHOICE", prompt: { text: "题目" }, answerKey: { value: "A" }, sortOrder: 0 }, principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId });

    expect(activity.id).toBe(activityId);
    expect(question.activityId).toBe(activityId);
    expect(prisma.learningActivity.create).toHaveBeenCalledOnce();
    expect(prisma.question.create).toHaveBeenCalledOnce();
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
  });

  it("reorders activity and question atomically to avoid unique sort conflicts", async () => {
    const prisma = fakePrisma();
    const versionId = "55555555-5555-4555-8555-555555555555";
    const activityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const questionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    useFakeTransaction(prisma);
    prisma.courseVersion.findFirst.mockResolvedValue({ id: versionId, schoolId, status: "DRAFT" });
    prisma.learningActivity.findUnique.mockResolvedValue({ id: activityId, lessonId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", sortOrder: 0 });
    prisma.question.findUnique.mockResolvedValue({ id: questionId, activityId, sortOrder: 0 });
    const controller = controllerFor(prisma);

    await controller.reorderCurriculumActivity(versionId, activityId, { sortOrder: 1 }, principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId });
    await controller.reorderCurriculumQuestion(versionId, questionId, { sortOrder: 1 }, principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId });

    expect(prisma.learningActivity.update).toHaveBeenCalledWith({ where: { id: activityId }, data: { sortOrder: -1 } });
    expect(prisma.learningActivity.updateMany).toHaveBeenCalledWith({ where: { lessonId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", sortOrder: 1 }, data: { sortOrder: 0 } });
    expect(prisma.question.update).toHaveBeenCalledWith({ where: { id: questionId }, data: { sortOrder: -1 } });
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
  });

  it("deletes unused draft content but protects learning evidence", async () => {
    const prisma = fakePrisma();
    const versionId = "55555555-5555-4555-8555-555555555555";
    const activityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const questionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    prisma.courseVersion.findFirst
      .mockResolvedValueOnce({ id: versionId, schoolId, status: "DRAFT" })
      .mockResolvedValueOnce({ id: versionId, schoolId, status: "DRAFT" })
      .mockResolvedValueOnce({ id: versionId, schoolId, status: "DRAFT" });
    prisma.learningActivity.findUnique.mockResolvedValueOnce({ id: activityId, lessonId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", _count: { progress: 0, attempts: 0 } }).mockResolvedValueOnce({ id: activityId, lessonId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", _count: { progress: 1, attempts: 0 } });
    prisma.question.findUnique.mockResolvedValue({ id: questionId, activityId, _count: { assessmentItems: 1 } });
    const controller = controllerFor(prisma);

    await expect(controller.deleteCurriculumActivity(versionId, activityId, principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId })).resolves.toMatchObject({ deleted: true });
    await expect(controller.deleteCurriculumActivity(versionId, activityId, principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId })).rejects.toThrow("已有学生学习记录");
    await expect(controller.deleteCurriculumQuestion(versionId, questionId, principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId })).rejects.toThrow("已有测评答题记录");
    expect(prisma.learningActivity.delete).toHaveBeenCalledOnce();
    expect(prisma.question.delete).not.toHaveBeenCalled();
  });

  it("batch-updates only content owned by the requested curriculum version", async () => {
    const prisma = fakePrisma();
    const versionId = "55555555-5555-4555-8555-555555555555";
    const activityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const questionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    prisma.courseVersion.findFirst.mockResolvedValue({ id: versionId, schoolId, status: "DRAFT" });
    prisma.learningActivity.findMany.mockResolvedValue([{ id: activityId }]);
    prisma.question.findMany.mockResolvedValue([{ id: questionId }]);
    useFakeTransaction(prisma);
    prisma.learningActivity.update.mockResolvedValue({ id: activityId, title: "批量活动", required: false, sortOrder: 1 });
    prisma.question.update.mockResolvedValue({ id: questionId, kind: "FILL_BLANK", sortOrder: 1 });
    const controller = controllerFor(prisma);

    const activities = await controller.batchUpdateCurriculumActivities(versionId, { updates: [{ id: activityId, title: "批量活动", required: false, sortOrder: 1 }] }, principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId });
    const questions = await controller.batchUpdateCurriculumQuestions(versionId, { updates: [{ id: questionId, kind: "FILL_BLANK", sortOrder: 1 }] }, principalFor(MembershipRole.SCHOOL_ADMIN), { schoolId });

    expect(activities.items[0]).toMatchObject({ id: activityId, sortOrder: 1 });
    expect(questions.items[0]).toMatchObject({ id: questionId, sortOrder: 1 });
    expect(prisma.learningActivity.update).toHaveBeenCalledWith({ where: { id: activityId }, data: { sortOrder: -1000000 } });
    expect(prisma.question.update).toHaveBeenCalledWith({ where: { id: questionId }, data: { sortOrder: -1000000 } });
  });
});
