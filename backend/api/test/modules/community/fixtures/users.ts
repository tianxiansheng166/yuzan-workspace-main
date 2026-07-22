import { MembershipRole, MembershipStatus } from "../../../../src/common/security/index.js";
import type { AuthContext, Principal, TenantContext } from "../../../../src/common/security/auth.types.js";

/* ------------------------------------------------------------------ */
/*  Helper: build an AuthContext for a given role / school             */
/* ------------------------------------------------------------------ */

export function makeAuthContext(
  userId: string,
  schoolId: string,
  role: MembershipRole,
  membershipStatus: MembershipStatus = MembershipStatus.ACTIVE,
): AuthContext {
  const principal: Principal = {
    userId,
    roles: [role],
    membershipStatus,
    source: "test",
  };
  const tenant: TenantContext = { schoolId };
  return { requestId: `req-${userId}`, principal, tenant };
}

/* ------------------------------------------------------------------ */
/*  Pre-built auth contexts for common roles                           */
/* ------------------------------------------------------------------ */

export const SCHOOL_ID = "school-1";
export const OTHER_SCHOOL_ID = "school-2";

export const studentAuth = makeAuthContext(
  "student-1",
  SCHOOL_ID,
  MembershipRole.STUDENT,
);

export const teacherAuth = makeAuthContext(
  "teacher-1",
  SCHOOL_ID,
  MembershipRole.TEACHER,
);

export const schoolAdminAuth = makeAuthContext(
  "school-admin-1",
  SCHOOL_ID,
  MembershipRole.SCHOOL_ADMIN,
);

export const platformAdminAuth = makeAuthContext(
  "platform-admin-1",
  SCHOOL_ID,
  MembershipRole.PLATFORM_ADMIN,
);

export const otherSchoolStudentAuth = makeAuthContext(
  "student-2",
  OTHER_SCHOOL_ID,
  MembershipRole.STUDENT,
);

export const suspendedStudentAuth = makeAuthContext(
  "student-3",
  SCHOOL_ID,
  MembershipRole.STUDENT,
  MembershipStatus.SUSPENDED,
);
