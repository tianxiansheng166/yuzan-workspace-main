import type { School, SchoolSummary } from "../domain/organization.types.js";

export interface SchoolResponse {
  readonly id: string;
  readonly name: string;
  readonly status: "ACTIVE" | "INACTIVE";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toSchoolResponse(school: School): SchoolResponse {
  return {
    id: school.id,
    name: school.name,
    status: school.status,
    createdAt: school.createdAt.toISOString(),
    updatedAt: school.updatedAt.toISOString(),
  };
}

export interface SchoolSummaryResponse {
  readonly id: string;
  readonly name: string;
  readonly status: "ACTIVE" | "INACTIVE";
}

export function toSchoolSummaryResponse(
  school: SchoolSummary,
): SchoolSummaryResponse {
  return {
    id: school.id,
    name: school.name,
    status: school.status,
  };
}
