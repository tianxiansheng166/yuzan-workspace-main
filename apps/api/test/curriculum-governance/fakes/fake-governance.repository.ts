import type { CourseVersionStatus } from "../../../src/modules/curriculum/domain/course-version.types.js";
import type {
  GovernanceCourseVersion,
  GovernanceCourseVersionSummary,
  GovernanceVersionListResult,
  ListGovernanceVersionsOptions,
} from "../../../src/modules/curriculum-governance/domain/governance.types.js";
import type { GovernanceRepositoryPort } from "../../../src/modules/curriculum-governance/ports/governance-repository.port.js";
import { GovernanceConflictException } from "../../../src/modules/curriculum-governance/domain/governance.errors.js";

export class FakeGovernanceRepository implements GovernanceRepositoryPort {
  private readonly versions = new Map<string, GovernanceCourseVersion>();
  public beforeUpdateHook: (() => void) | null = null;

  add(...versions: GovernanceCourseVersion[]): void {
    for (const version of versions) {
      this.versions.set(version.id, version);
    }
  }

  /** Internal method used by hooks to replace a version directly. */
  addInternal(version: GovernanceCourseVersion): void {
    this.versions.set(version.id, version);
  }

  async listAll(options: ListGovernanceVersionsOptions): Promise<GovernanceVersionListResult> {
    let items = Array.from(this.versions.values());

    if (options.status) {
      items = items.filter((v) => v.status === options.status);
    }

    if (options.schoolId) {
      items = items.filter((v) => v.schoolId === options.schoolId);
    }

    // Sort by updatedAt descending for stable ordering
    items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    // Build summaries
    const summaries: GovernanceCourseVersionSummary[] = items.map((v) => ({
      id: v.id,
      courseId: v.courseId,
      version: v.version,
      title: v.title,
      status: v.status,
      gradeBand: v.gradeBand,
      schoolId: v.schoolId,
      updatedAt: v.updatedAt,
    }));

    // Cursor-based pagination
    let startIndex = 0;
    if (options.cursor) {
      const cursorIndex = summaries.findIndex((s) => s.id === options.cursor);
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginated = summaries.slice(startIndex, startIndex + options.limit);
    const hasMore = startIndex + options.limit < summaries.length;
    const lastItem = paginated[paginated.length - 1];

    return {
      items: paginated,
      nextCursor: lastItem?.id ?? null,
      hasMore,
    };
  }

  async findById(schoolId: string, id: string): Promise<GovernanceCourseVersion | null> {
    const version = this.versions.get(id);
    if (!version || version.schoolId !== schoolId) {
      return null;
    }
    return version;
  }

  async updateStatus(
    schoolId: string,
    id: string,
    status: CourseVersionStatus,
    timestampFields: Record<string, Date>,
    expectedUpdatedAt: Date,
  ): Promise<GovernanceCourseVersion> {
    // Invoke hook before performing the update to simulate concurrent writes
    if (this.beforeUpdateHook) {
      this.beforeUpdateHook();
    }

    const existing = this.versions.get(id);
    if (!existing || existing.schoolId !== schoolId) {
      throw new GovernanceConflictException("课程版本未找到");
    }

    // Optimistic concurrency check
    if (existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
      throw new GovernanceConflictException(
        "课程版本已被其他操作修改，请刷新后重试",
      );
    }

    const now = new Date();
    const updated: GovernanceCourseVersion = {
      ...existing,
      status,
      updatedAt: now,
      ...timestampFields,
    };

    this.versions.set(id, updated);
    return updated;
  }

  async findByIdPlatformWide(id: string): Promise<GovernanceCourseVersion | null> {
    return this.versions.get(id) ?? null;
  }
}
