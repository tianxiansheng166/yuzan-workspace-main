import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../../src/common/security/auth.types.js";
import { MembershipStatus } from "../../src/common/security/auth.types.js";
import { MembershipRole } from "../../src/common/security/membership-role.js";
import { PracticeService } from "../../src/modules/assessment/practice.service.js";
import type { PrismaService } from "../../src/shared/database/prisma.service.js";

const schoolId = "11111111-1111-4111-8111-111111111111";
const foreignSchool = "22222222-2222-4222-8222-222222222222";
const studentId = "33333333-3333-4333-8333-333333333333";
const enrollment = { id: "enrollment-1", classId: "class-1" };
const definitionId = "definition-1";
const versionId = "version-1";
const attemptId = "attempt-1";
const auth: AuthContext = {
  requestId: "t087",
  tenant: { schoolId },
  principal: {
    userId: studentId,
    roles: [MembershipRole.STUDENT],
    membershipStatus: MembershipStatus.ACTIVE,
    source: "session",
  },
};
const legitimateVersion = () => ({
  id: versionId,
  status: "PUBLISHED",
  publishedAt: new Date("2026-01-01T00:00:00.000Z"),
  item: { schoolId },
  deliverySpec: { targetText: "synthetic practice fixture" },
  scoringSpec: { maxScore: 10, correctAnswer: "backend-secret" },
});

type Version = ReturnType<typeof legitimateVersion> | null;
const createDelivery = (versions: Array<{ ref: string | null; version: Version }>) => ({
  id: "delivery-1",
  practiceVersionId: "practice-version-1",
  classId: enrollment.classId,
  practiceVersion: {
    definitionId,
    sections: [{
      title: "Technical fixture",
      sortOrder: 1,
      items: versions.map(({ ref, version }, index) => ({
        questionVersionId: ref,
        questionVersion: version,
        sortOrder: index + 1,
        itemType: "LISTEN_REPEAT",
        config: { targetText: "LEGACY CONFIG MUST NEVER CREATE AN ATTEMPT", maxScore: 999 },
      })),
    }],
  },
});

function harness(versions = [{ ref: versionId, version: legitimateVersion() }]) {
  const delivery = createDelivery(versions);
  const session = { id: attemptId, status: "CREATED", courseSubmissionId: null, courseActivityId: null };
  const tx = {
    practiceDelivery: { findFirst: vi.fn().mockResolvedValue(delivery) },
    submission: { findFirst: vi.fn().mockResolvedValue({ id: "submission-1", enrollmentId: enrollment.id }) },
    courseActivityPractice: { findFirst: vi.fn().mockResolvedValue({ activityId: "activity-1" }) },
    assessmentSession: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(session),
    },
    assessmentItem: { createMany: vi.fn().mockResolvedValue({ count: versions.length }) },
  };
  const prisma = {
    enrollment: { findMany: vi.fn().mockResolvedValue([enrollment]) },
    assessmentSession: { findFirst: vi.fn().mockResolvedValue(null) },
    assessmentItem: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  return {
    tx,
    prisma,
    service: new PracticeService(prisma as unknown as PrismaService),
    assertNoWrites() {
      expect(tx.assessmentSession.create).not.toHaveBeenCalled();
      expect(tx.assessmentItem.createMany).not.toHaveBeenCalled();
    },
  };
}

describe("T087 – fail-closed Practice eligibility gate", () => {
  const invalid: Array<{ label: string; ref: string | null; version: Version; error: typeof BadRequestException | typeof ForbiddenException }> = [
    { label: "null questionVersionId (legacy config)", ref: null, version: null, error: BadRequestException },
    { label: "missing referenced version", ref: versionId, version: null, error: BadRequestException },
    { label: "mismatched relation version", ref: "other-version", version: legitimateVersion(), error: BadRequestException },
    { label: "DRAFT version", ref: versionId, version: { ...legitimateVersion(), status: "DRAFT" }, error: BadRequestException },
    { label: "RETIRED version", ref: versionId, version: { ...legitimateVersion(), status: "RETIRED" }, error: BadRequestException },
    { label: "no publishedAt", ref: versionId, version: { ...legitimateVersion(), publishedAt: null as never }, error: BadRequestException },
    { label: "invalid publishedAt", ref: versionId, version: { ...legitimateVersion(), publishedAt: new Date("invalid") }, error: BadRequestException },
    { label: "future publishedAt", ref: versionId, version: { ...legitimateVersion(), publishedAt: new Date("2099-01-01") }, error: BadRequestException },
    { label: "another school's item", ref: versionId, version: { ...legitimateVersion(), item: { schoolId: foreignSchool } }, error: ForbiddenException },
    { label: "unapproved global item", ref: versionId, version: { ...legitimateVersion(), item: { schoolId: null as never } }, error: ForbiddenException },
  ];

  for (const testCase of invalid) {
    it(`rejects ${testCase.label} before even checking a previous attempt or writing`, async () => {
      const h = harness([{ ref: testCase.ref, version: testCase.version }]);
      await expect(h.service.createOrResume(auth, schoolId, definitionId)).rejects.toBeInstanceOf(testCase.error);
      expect(h.tx.assessmentSession.findFirst).not.toHaveBeenCalled();
      h.assertNoWrites();
    });
    it(`does not resume a legacy OPEN attempt when ${testCase.label}`, async () => {
      const h = harness([{ ref: testCase.ref, version: testCase.version }]);
      h.tx.assessmentSession.findFirst.mockResolvedValue({ id: attemptId, status: "IN_PROGRESS" });
      await expect(h.service.createOrResume(auth, schoolId, definitionId)).rejects.toBeInstanceOf(testCase.error);
      expect(h.tx.assessmentSession.findFirst).not.toHaveBeenCalled();
      h.assertNoWrites();
    });
  }

  it("validates the entire required snapshot rather than just the first published item", async () => {
    const h = harness([
      { ref: versionId, version: legitimateVersion() },
      { ref: "bad-version", version: null },
    ]);
    await expect(h.service.createOrResume(auth, schoolId, definitionId)).rejects.toBeInstanceOf(BadRequestException);
    h.assertNoWrites();
  });

  it("creates one attempt and only snapshots the approved version deliverySpec", async () => {
    const h = harness();
    await expect(h.service.createOrResume(auth, schoolId, definitionId)).resolves.toMatchObject({
      attemptId, resumed: false, mode: "SELF_PRACTICE",
    });
    expect(h.tx.assessmentSession.create).toHaveBeenCalledTimes(1);
    expect(h.tx.assessmentItem.createMany).toHaveBeenCalledTimes(1);
    expect(h.tx.assessmentItem.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        sessionId: attemptId,
        questionVersionId: versionId,
        prompt: { targetText: "synthetic practice fixture" },
        itemConfig: { targetText: "synthetic practice fixture" },
        maxScore: 10,
      })],
    });
    expect(JSON.stringify(h.tx.assessmentItem.createMany.mock.calls)).not.toContain("backend-secret");
    expect(JSON.stringify(h.tx.assessmentItem.createMany.mock.calls)).not.toContain("LEGACY CONFIG");
  });

  it("resumes the same eligible OPEN attempt without creating a new one", async () => {
    const h = harness();
    h.tx.assessmentSession.findFirst.mockResolvedValue({
      id: attemptId, status: "IN_PROGRESS", courseSubmissionId: null, courseActivityId: null,
    });
    await expect(h.service.createOrResume(auth, schoolId, definitionId)).resolves.toMatchObject({
      attemptId, resumed: true,
    });
    expect(h.tx.assessmentSession.findFirst).toHaveBeenCalledTimes(1);
    h.assertNoWrites();
  });

  it("rejects empty published practices before creating an attempt", async () => {
    const h = harness([]);
    await expect(h.service.createOrResume(auth, schoolId, definitionId)).rejects.toBeInstanceOf(BadRequestException);
    h.assertNoWrites();
  });

  it("rejects another school and non-student roles before querying a delivery", async () => {
    const h = harness();
    await expect(h.service.createOrResume(auth, foreignSchool, definitionId)).rejects.toBeInstanceOf(ForbiddenException);
    const teacher = { ...auth, principal: { ...auth.principal, roles: [MembershipRole.TEACHER] } };
    await expect(h.service.createOrResume(teacher, schoolId, definitionId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(h.prisma.enrollment.findMany).not.toHaveBeenCalled();
    h.assertNoWrites();
  });

  it("rejects students without active enrollment", async () => {
    const h = harness();
    h.prisma.enrollment.findMany.mockResolvedValue([]);
    await expect(h.service.createOrResume(auth, schoolId, definitionId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
    h.assertNoWrites();
  });

  it("returns 404 when there is no authorized OPEN delivery", async () => {
    const h = harness();
    h.tx.practiceDelivery.findFirst.mockResolvedValue(null);
    await expect(h.service.createOrResume(auth, schoolId, definitionId)).rejects.toBeInstanceOf(NotFoundException);
    h.assertNoWrites();
  });

  it("keeps course submission and activity scope checks before any write", async () => {
    const h = harness();
    h.tx.submission.findFirst.mockResolvedValue(null);
    await expect(h.service.createOrResume(auth, schoolId, definitionId, {
      assignmentId: "foreign", submissionId: "foreign", activityId: "foreign",
    })).rejects.toBeInstanceOf(ForbiddenException);
    h.assertNoWrites();
  });

  it("permits the authorized course context with a legal version", async () => {
    const h = harness();
    h.tx.submission.findFirst.mockResolvedValue({ enrollmentId: enrollment.id, id: "submission-1" });
    await expect(h.service.createOrResume(auth, schoolId, definitionId, {
      assignmentId: "assignment-1", submissionId: "submission-1", activityId: "activity-1",
    })).resolves.toMatchObject({ attemptId });
    expect(JSON.stringify(h.tx.assessmentSession.create.mock.calls)).toContain('"courseSubmissionId":"submission-1"');
    expect(JSON.stringify(h.tx.assessmentSession.create.mock.calls)).toContain('"courseActivityId":"activity-1"');
  });

  it("preserves historical COMPLETED attempt access without rechecking a withdrawn delivery", async () => {
    const h = harness([{ ref: versionId, version: null }]);
    const historical = { id: attemptId, practiceDefinitionId: definitionId, status: "COMPLETED" };
    h.prisma.assessmentSession.findFirst.mockResolvedValue(historical);
    await expect(h.service.getAttempt(auth, schoolId, attemptId)).resolves.toEqual(historical);
    await expect(h.service.getAttemptItems(auth, schoolId, attemptId)).resolves.toEqual([]);
    expect(h.tx.practiceDelivery.findFirst).not.toHaveBeenCalled();
    h.assertNoWrites();
  });
});
