import type { AdminSchool, SchoolUsageStats } from "../domain/admin.types.js";

export interface AdminSchoolResponse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly timezone: string;
  readonly regionCode: string | null;
  readonly isActive: boolean;
  readonly planId: string | null;
  readonly planTier: string | null;
  readonly membershipCount: number;
  readonly classCount: number;
  readonly courseCount: number;
  readonly archived: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

export function toAdminSchoolResponse(school: AdminSchool): AdminSchoolResponse {
  return {
    id: school.id,
    code: school.code,
    name: school.name,
    timezone: school.timezone,
    regionCode: school.regionCode,
    isActive: school.isActive,
    planId: school.planId,
    planTier: school.planTier,
    membershipCount: school.membershipCount,
    classCount: school.classCount,
    courseCount: school.courseCount,
    archived: school.deletedAt !== null,
    createdAt: school.createdAt.toISOString(),
    updatedAt: school.updatedAt.toISOString(),
    deletedAt: school.deletedAt?.toISOString() ?? null,
  };
}

export interface SchoolUsageStatsResponse {
  readonly membershipCount: number;
  readonly classCount: number;
  readonly courseCount: number;
  readonly assignmentCount: number;
  readonly submissionCount: number;
}

export function toSchoolUsageStatsResponse(
  stats: SchoolUsageStats,
): SchoolUsageStatsResponse {
  return {
    membershipCount: stats.membershipCount,
    classCount: stats.classCount,
    courseCount: stats.courseCount,
    assignmentCount: stats.assignmentCount,
    submissionCount: stats.submissionCount,
  };
}
