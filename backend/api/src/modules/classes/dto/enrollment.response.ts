import type { ClassEnrollment } from "../domain/class.types.js";

export interface EnrollmentResponse {
  readonly id: string;
  readonly classId: string;
  readonly userId: string;
  readonly roleInClass: string;
  readonly status: string;
}

export function toEnrollmentResponse(e: ClassEnrollment): EnrollmentResponse {
  return {
    id: e.id,
    classId: e.classId,
    userId: e.userId,
    roleInClass: e.roleInClass,
    status: e.status,
  };
}
