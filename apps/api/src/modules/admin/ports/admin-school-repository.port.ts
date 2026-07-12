import type {
  AdminSchool,
  SchoolUsageStats,
} from "../domain/admin.types.js";

export const ADMIN_SCHOOL_REPOSITORY = Symbol("ADMIN_SCHOOL_REPOSITORY");

export interface AdminSchoolListOptions {
  readonly isActive?: boolean;
  readonly search?: string;
  readonly cursor?: string;
  readonly limit: number;
}

export interface AdminSchoolListResult {
  readonly items: readonly AdminSchool[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface AdminSchoolRepositoryPort {
  list(options: AdminSchoolListOptions): Promise<AdminSchoolListResult>;
  findById(id: string): Promise<AdminSchool | null>;
  save(school: AdminSchool): Promise<AdminSchool>;
  activate(id: string): Promise<AdminSchool | null>;
  deactivate(id: string): Promise<AdminSchool | null>;
  archive(id: string): Promise<AdminSchool | null>;
  assignPlan(schoolId: string, planId: string): Promise<AdminSchool | null>;
  getUsageStats(schoolId: string): Promise<SchoolUsageStats>;
  hasBusinessData(schoolId: string): Promise<boolean>;
}
