import type {
  AdminSchool,
  SchoolUsageStats,
} from "../../../src/modules/admin/domain/admin.types.js";
import { AdminConflictException } from "../../../src/modules/admin/domain/admin.errors.js";
import type {
  AdminSchoolListOptions,
  AdminSchoolListResult,
  AdminSchoolRepositoryPort,
} from "../../../src/modules/admin/ports/admin-school-repository.port.js";

export class FakeAdminSchoolRepository implements AdminSchoolRepositoryPort {
  private readonly schools = new Map<string, AdminSchool>();
  private readonly businessDataFlags = new Map<string, boolean>();

  add(...schools: AdminSchool[]): void {
    for (const school of schools) {
      this.schools.set(school.id, school);
    }
  }

  setBusinessData(schoolId: string, hasData: boolean): void {
    this.businessDataFlags.set(schoolId, hasData);
  }

  async list(options: AdminSchoolListOptions): Promise<AdminSchoolListResult> {
    let items = Array.from(this.schools.values());

    // Filter out soft-deleted schools
    items = items.filter((s) => s.deletedAt === null);

    if (options.isActive !== undefined) {
      items = items.filter((s) => s.isActive === options.isActive);
    }

    if (options.search) {
      const search = options.search.toLowerCase();
      items = items.filter(
        (s) =>
          s.name.toLowerCase().includes(search) ||
          s.code.toLowerCase().includes(search),
      );
    }

    // Sort by createdAt descending for stable ordering
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Cursor-based pagination: cursor is the id of the last item
    let startIndex = 0;
    if (options.cursor) {
      const cursorIndex = items.findIndex((s) => s.id === options.cursor);
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginated = items.slice(startIndex, startIndex + options.limit);
    const hasMore = startIndex + options.limit < items.length;
    const lastItem = paginated[paginated.length - 1];

    return {
      items: paginated,
      nextCursor: lastItem?.id ?? null,
      hasMore,
    };
  }

  async findById(id: string): Promise<AdminSchool | null> {
    return this.schools.get(id) ?? null;
  }

  async save(school: AdminSchool): Promise<AdminSchool> {
    this.schools.set(school.id, school);
    return school;
  }

  async softDelete(id: string): Promise<void> {
    const school = this.schools.get(id);
    if (school) {
      this.schools.set(id, { ...school, deletedAt: new Date() });
    }
  }

  async activate(id: string): Promise<AdminSchool | null> {
    const school = this.schools.get(id);
    if (!school) {
      return null;
    }
    if (school.isActive) {
      throw new AdminConflictException("学校已经是启用状态");
    }
    const activated = { ...school, isActive: true, updatedAt: new Date() };
    this.schools.set(id, activated);
    return activated;
  }

  async deactivate(id: string): Promise<AdminSchool | null> {
    const school = this.schools.get(id);
    if (!school) {
      return null;
    }
    if (!school.isActive) {
      throw new AdminConflictException("学校已经是停用状态");
    }
    const deactivated = { ...school, isActive: false, updatedAt: new Date() };
    this.schools.set(id, deactivated);
    return deactivated;
  }

  async archive(id: string): Promise<AdminSchool | null> {
    const school = this.schools.get(id);
    if (!school) {
      return null;
    }
    const archived = { ...school, deletedAt: new Date(), updatedAt: new Date() };
    this.schools.set(id, archived);
    return archived;
  }

  async assignPlan(
    schoolId: string,
    planId: string,
  ): Promise<AdminSchool | null> {
    const school = this.schools.get(schoolId);
    if (!school) {
      return null;
    }
    const updated = { ...school, planId, updatedAt: new Date() };
    this.schools.set(schoolId, updated);
    return updated;
  }

  async getUsageStats(_schoolId: string): Promise<SchoolUsageStats> {
    return {
      membershipCount: 50,
      classCount: 10,
      courseCount: 20,
      assignmentCount: 100,
      submissionCount: 400,
    };
  }

  async hasBusinessData(id: string): Promise<boolean> {
    return this.businessDataFlags.get(id) ?? false;
  }
}
