import { describe, expect, it, vi } from "vitest";
import { AssessmentLinkController } from "../../../src/modules/mvp-gaps/assessment-link.controller.js";
import { MembershipRole } from "../../../src/common/security/index.js";

const schoolId = "11111111-1111-4111-8111-111111111111";
const userId = "33333333-3333-4333-8333-333333333333";

function fakePrisma() {
  const prisma: any = {
    assessmentLink: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    enrollment: { findFirst: vi.fn() },
    assessmentLinkAccess: { create: vi.fn() },
  };
  prisma.$transaction = vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma));
  return prisma;
}

describe("AssessmentLinkController", () => {
  it("resolves only for the targeted student and increments use count", async () => {
    const prisma = fakePrisma();
    prisma.assessmentLink.findUnique.mockResolvedValue({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", schoolId, assessmentKey: "reading-v1", title: "朗读", targetType: "STUDENT", targetId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", status: "ACTIVE", expiresAt: new Date(Date.now() + 60_000), maxUses: 1, usedCount: 0 });
    prisma.enrollment.findFirst.mockResolvedValue({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", classId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" });
    prisma.assessmentLink.updateMany.mockResolvedValue({ count: 1 });
    const controller = new AssessmentLinkController(prisma);

    const result = await controller.resolve({ token: "a".repeat(32) }, { userId, roles: [MembershipRole.STUDENT], membershipStatus: "ACTIVE", source: "test" }, { schoolId });

    expect(result.enrollmentId).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(prisma.assessmentLink.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "ACTIVE", usedCount: { lt: 1 } }) }));
    expect(prisma.assessmentLinkAccess.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ outcome: "RESOLVED" }) }));
  });

  it("rejects a link from another tenant before target lookup", async () => {
    const prisma = fakePrisma();
    prisma.assessmentLink.findUnique.mockResolvedValue({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", schoolId, status: "ACTIVE", expiresAt: new Date(Date.now() + 60_000), maxUses: 1, usedCount: 0, targetType: "STUDENT", targetId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" });
    const controller = new AssessmentLinkController(prisma);

    await expect(controller.resolve({ token: "a".repeat(32) }, { userId, roles: [MembershipRole.STUDENT], membershipStatus: "ACTIVE", source: "test" }, { schoolId: "22222222-2222-4222-8222-222222222222" })).rejects.toThrow("当前学校无权");
    expect(prisma.enrollment.findFirst).not.toHaveBeenCalled();
  });
});
