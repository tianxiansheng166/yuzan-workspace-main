import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../src/shared/database/prisma.service.js";
import { PrismaVolunteerRepository } from "../src/modules/volunteers/infra/prisma-volunteer.repository.js";
import { PrismaTrainingRepository } from "../src/modules/training/infra/prisma-training.repository.js";
import { PrismaSupportPairingRepository } from "../src/modules/support-pairings/infra/prisma-support-pairing.repository.js";
import { VolunteersPolicy } from "../src/modules/volunteers/volunteers.policy.js";
import {
  MembershipRole,
  MembershipStatus,
  createAuthContext,
} from "../src/common/security/index.js";

function prismaMock() {
  return {
    volunteerProfile: { findFirst: vi.fn().mockResolvedValue(null) },
    trainingProgress: { findMany: vi.fn().mockResolvedValue([]) },
    supportPairing: { findFirst: vi.fn().mockResolvedValue(null) },
  };
}

describe("volunteer persistence tenant isolation", () => {
  it("always includes school scope in profile, progress and pairing reads", async () => {
    const prisma = prismaMock();
    await new PrismaVolunteerRepository(
      prisma as unknown as PrismaService,
    ).findById("school-a", "profile-b");
    await new PrismaTrainingRepository(
      prisma as unknown as PrismaService,
    ).findProgressByEnrollment("school-a", "enrollment-b");
    await new PrismaSupportPairingRepository(
      prisma as unknown as PrismaService,
    ).findById("school-a", "pairing-b");

    expect(prisma.volunteerProfile.findFirst).toHaveBeenCalledWith({
      where: { schoolId: "school-a", id: "profile-b" },
    });
    expect(prisma.trainingProgress.findMany).toHaveBeenCalledWith({
      where: { schoolId: "school-a", enrollmentId: "enrollment-b" },
      orderBy: { createdAt: "asc" },
    });
    expect(prisma.supportPairing.findFirst).toHaveBeenCalledWith({
      where: { schoolId: "school-a", id: "pairing-b" },
    });
  });

  it("rejects a volunteer using a different active school", () => {
    const auth = createAuthContext(
      "request-test",
      {
        userId: "volunteer",
        roles: [MembershipRole.VOLUNTEER],
        membershipStatus: MembershipStatus.ACTIVE,
        source: "test",
      },
      { schoolId: "school-a" },
    );
    const policy = new VolunteersPolicy();
    expect(policy.canViewOwnVolunteerProfile(auth, "school-a")).toBe(true);
    expect(policy.canViewOwnVolunteerProfile(auth, "school-b")).toBe(false);
    expect(policy.canViewAssignedServiceTasks(auth, "school-b")).toBe(false);
  });
});
