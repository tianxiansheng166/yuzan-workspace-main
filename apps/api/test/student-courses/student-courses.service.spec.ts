import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { MembershipRole } from "../../src/common/security/membership-role.js";
import { MembershipStatus, type AuthContext } from "../../src/common/security/auth.types.js";
import { StudentCoursesService } from "../../src/modules/student-courses/student-courses.service.js";

const schoolId = "11111111-1111-4111-8111-111111111111";
const otherSchoolId = "99999999-9999-4999-8999-999999999999";
const studentId = "22222222-2222-4222-8222-222222222222";
const enrollmentId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function auth(userId = studentId, tenantSchoolId = schoolId): AuthContext {
  return {
    requestId: "course-test",
    tenant: { schoolId: tenantSchoolId },
    principal: { userId, roles: [MembershipRole.STUDENT], membershipStatus: MembershipStatus.ACTIVE, source: "session" },
  };
}

describe("StudentCoursesService security and completion", () => {
  it("rejects a cross-school catalog read before querying enrollment", async () => {
    const prisma = { enrollment: { findFirst: vi.fn() } };
    const service = new StudentCoursesService(prisma as any);
    await expect(service.list(auth(), otherSchoolId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.enrollment.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a different student without an active scoped enrollment", async () => {
    const prisma = { enrollment: { findFirst: vi.fn().mockResolvedValue(null) } };
    const service = new StudentCoursesService(prisma as any);
    await expect(service.list(auth("33333333-3333-4333-8333-333333333333"), schoolId)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("keeps attainment PENDING when learning is 100 percent but speech is processing", () => {
    const service = new StudentCoursesService({} as any);
    const result = (service as any).attainment([{ status: "PROCESSING", result: null, errorCode: null }], 100);
    expect(result).toBe("PENDING");
  });

  it("reports provider unavailability without reducing learning completion", () => {
    const service = new StudentCoursesService({} as any);
    const result = (service as any).attainment([{ status: "FAILED", result: null, errorCode: "PROVIDER_UNAVAILABLE" }], 100);
    expect(result).toBe("PROVIDER_UNAVAILABLE");
  });

  it("does not expose unpublished course points", () => {
    const service = new StudentCoursesService({} as any);
    expect((service as any).publishedStudentNotes({ published: false, items: ["private"] })).toBeNull();
    expect((service as any).publishedStudentNotes({ published: true, items: ["public"] })).toMatchObject({ items: ["public"] });
  });
});
