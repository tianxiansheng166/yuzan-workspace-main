import type {
  Assignment,
  AssignmentSummary,
} from "../../../src/modules/assignments/domain/assignment.types.js";
import type {
  AssignmentRepositoryPort,
  ListAssignmentsOptions,
  PaginatedResult,
  SaveAssignmentOptions,
} from "../../../src/modules/assignments/ports/assignment-repository.port.js";

export class FakeAssignmentRepository implements AssignmentRepositoryPort {
  private readonly assignments = new Map<string, Assignment>();

  add(...assignments: Assignment[]): void {
    for (const assignment of assignments) {
      this.assignments.set(assignment.id, assignment);
    }
  }

  async findById(
    schoolId: string,
    assignmentId: string,
  ): Promise<Assignment | null> {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment || assignment.schoolId !== schoolId) {
      return null;
    }
    return assignment;
  }

  async list(
    schoolId: string,
    options: ListAssignmentsOptions,
  ): Promise<PaginatedResult<AssignmentSummary>> {
    let all = Array.from(this.assignments.values()).filter(
      (a) => a.schoolId === schoolId,
    );

    if (options.classId) {
      all = all.filter((a) => a.classId === options.classId);
    }

    if (options.status) {
      all = all.filter((a) => a.status === options.status);
    }

    const limit = options.limit;
    const start = options.cursor ? Number.parseInt(options.cursor, 10) : 0;
    const items = all.slice(start, start + limit).map((a) => ({
      id: a.id,
      classId: a.classId,
      courseVersionId: a.courseVersionId,
      title: a.title,
      status: a.status,
      publishAt: a.publishAt ?? null,
      dueAt: a.dueAt ?? null,
      updatedAt: a.updatedAt,
    }));

    return {
      items,
      nextCursor: all.length > start + limit ? String(start + limit) : null,
      hasMore: all.length > start + limit,
    };
  }

  async save(
    assignment: Assignment,
    _options?: SaveAssignmentOptions,
  ): Promise<Assignment> {
    this.assignments.set(assignment.id, assignment);
    return assignment;
  }
}
