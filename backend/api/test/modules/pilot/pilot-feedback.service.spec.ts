import { describe, expect, it, vi } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { PilotFeedbackService } from "../../../src/modules/pilot/pilot-feedback.service.js";
import { MembershipRole, MembershipStatus, createAuthContext } from "../../../src/common/security/index.js";

const schoolId = "00000000-0000-0000-0000-000000000001";
const otherSchoolId = "00000000-0000-0000-0000-000000000002";
const student = createAuthContext("request", { userId: "student-1", roles: [MembershipRole.STUDENT], membershipStatus: MembershipStatus.ACTIVE, source: "test" }, { schoolId });
const otherStudent = createAuthContext("request", { userId: "student-2", roles: [MembershipRole.STUDENT], membershipStatus: MembershipStatus.ACTIVE, source: "test" }, { schoolId });
const admin = createAuthContext("request", { userId: "admin-1", roles: [MembershipRole.SCHOOL_ADMIN], membershipStatus: MembershipStatus.ACTIVE, source: "test" }, { schoolId });

function contextPrisma() {
  return {
    assessmentItem: {
      findFirst: vi.fn().mockResolvedValue({
        id: "item-1", sessionId: "session-1", questionVersionId: "version-1",
        session: { classId: "class-1", enrollment: { userId: "student-1", role: MembershipRole.STUDENT, status: "ACTIVE" } },
      }),
    },
    enrollment: { count: vi.fn().mockResolvedValue(0) },
    pilotFeedback: {
      create: vi.fn().mockResolvedValue({ id: "feedback-1", status: "OPEN", category: "CONTENT", createdAt: new Date("2026-08-24T00:00:00Z") }),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue({ id: "feedback-1", status: "OPEN" }),
      update: vi.fn().mockResolvedValue({ id: "feedback-1", status: "RESOLVED", resolutionNote: "已修复", resolvedAt: new Date("2026-08-24T01:00:00Z"), updatedAt: new Date("2026-08-24T01:00:00Z") }),
    },
  };
}

describe("PilotFeedbackService", () => {
  it("stores only server-authorized IDs and returns OPEN", async () => {
    const prisma = contextPrisma();
    const service = new PilotFeedbackService(prisma as never);

    const result = await service.create(student, schoolId, { category: "CONTENT", message: "题目中的图片与文字不一致", sessionId: "session-1", assessmentItemId: "item-1", currentPath: "/student/practices/attempts/session-1/runner" });

    expect(result).toMatchObject({ feedbackId: "feedback-1", status: "OPEN" });
    expect(prisma.pilotFeedback.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ schoolId, reporterUserId: "student-1", questionVersionId: "version-1" }) }));
    const data = prisma.pilotFeedback.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data).not.toHaveProperty("answer");
    expect(data).not.toHaveProperty("transcript");
    expect(data).not.toHaveProperty("audio");
  });

  it("forbids a student from attaching another student's item", async () => {
    const prisma = contextPrisma();
    prisma.assessmentItem.findFirst.mockResolvedValueOnce(null);
    const service = new PilotFeedbackService(prisma as never);

    await expect(service.create(otherStudent, schoolId, { category: "SCORING", message: "我看到的评分结果有问题", assessmentItemId: "item-1" })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("forbids cross-school feedback routes and lets an admin resolve feedback", async () => {
    const prisma = contextPrisma();
    const service = new PilotFeedbackService(prisma as never);

    await expect(service.mine(student, otherSchoolId)).rejects.toBeInstanceOf(ForbiddenException);
    const result = await service.updateStatus(admin, schoolId, "feedback-1", { status: "RESOLVED", resolutionNote: "已修复并记录" });
    expect(result.status).toBe("RESOLVED");
    expect(prisma.pilotFeedback.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ handledByUserId: "admin-1", status: "RESOLVED" }) }));
  });
});
