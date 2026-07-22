/**
 * Atomic permissions used by the tenant authorization baseline.
 *
 * These are intentionally coarse at the MVP stage. IDN-001/ORG-001/CUR-001
 * can rely on role checks today and migrate to finer-grained permissions
 * without changing the guard interface.
 */
export enum Permission {
  // Platform administration
  PLATFORM_MANAGE_SCHOOLS = "platform:schools:manage",
  PLATFORM_VIEW_AUDIT_LOGS = "platform:audit:read",

  // School administration
  SCHOOL_MANAGE_MEMBERS = "school:members:manage",
  SCHOOL_MANAGE_CLASSES = "school:classes:manage",
  SCHOOL_MANAGE_COURSES = "school:courses:manage",
  SCHOOL_VIEW_REPORTS = "school:reports:read",

  // Teaching
  COURSE_MANAGE = "course:manage",
  ASSIGNMENT_MANAGE = "assignment:manage",
  ASSIGNMENT_REVIEW = "assignment:review",
  FEEDBACK_PROVIDE = "feedback:provide",

  // Learning / student
  ASSIGNMENT_SUBMIT = "assignment:submit",
  PROGRESS_READ_OWN = "progress:read:own",
  CONTENT_READ = "content:read",

  // Research
  RESEARCH_READ_ANONYMIZED = "research:read:anonymized",
}

export const PERMISSIONS = Object.values(Permission) as readonly Permission[];

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && PERMISSIONS.includes(value as Permission);
}
