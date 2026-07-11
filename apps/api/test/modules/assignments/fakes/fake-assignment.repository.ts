import type {
  Assignment,
  AssignmentSummary,
  CreateAssignmentInput,
  UpdateAssignmentInput,
  AssignmentStatus,
} from "../../../../src/modules/assignments/domain/assignment.types.js";
import type {
  AssignmentRepositoryPort,
  FindVisibleClassOptions,
  ListAssignmentsOptions,
  PaginatedResult,
} from "../../../../src/modules/assignments/ports/assignment-repository.port.js";

export class FakeAssignmentRepository implements AssignmentRepositoryPort {
  private readonly assignments = new Map<string, Assignment>();
  private idCounter = 0;

  add(...items: Assignment[]): void {
    for (const a of items) {
      this.assignments.set(a.id, a);
    }
  }

  async findById(schoolId: string, assignmentId: string): Promise<Assignment | null> {
    const item = this.assignments.get(assignmentId);
    if (!item || item.schoolId !== schoolId) return null;
    return item;
  }

  async list(schoolId: string, options: ListAssignmentsOptions): Promise<PaginatedResult<AssignmentSummary>> {
    let all = Array.from(this.assignments.values()).filter(
      (a) => a.schoolId === schoolId,
    );

    if (options.status) {
      all = all.filter((a) => a.status === options.status);
    }

    const limit = options.limit;
    const start = options.cursor ? Number.parseInt(options.cursor, 10) : 0;
    const items = all.slice(start, start + limit).map(toSummary);
    const hasMore = all.length > start + limit;
    return {
      items,
      nextCursor: hasMore ? String(start + limit) : null,
      hasMore,
    };
  }

  async listByEnrollment(schoolId: string, enrollmentId: string): Promise<readonly AssignmentSummary[]> {
    return Array.from(this.assignments.values())
      .filter((a) => a.schoolId === schoolId)
      .map(toSummary);
  }

  async save(input: CreateAssignmentInput, createdByUserId: string): Promise<Assignment> {
    const id = `assignment-${++this.idCounter}`;
    const now = new Date();
    const item: Assignment = {
      id,
      schoolId: input.schoolId,
      courseVersionId: input.courseVersionId,
      createdByUserId,
      title: input.title,
      status: "DRAFT",
      startsAt: input.startsAt,
      dueAt: input.dueAt,
      offlineRequired: input.offlineRequired ?? false,
      revision: 1,
      targets: input.targets.map((t, i) => ({
        id: `target-${this.idCounter}-${i}`,
        schoolId: input.schoolId,
        assignmentId: id,
        targetType: t.targetType,
        ...(t.classId ? { classId: t.classId } : {}),
        ...(t.enrollmentId ? { enrollmentId: t.enrollmentId } : {}),
      })),
      createdAt: now,
      updatedAt: now,
    };
    this.assignments.set(id, item);
    return item;
  }

  async update(
    schoolId: string,
    assignmentId: string,
    data: UpdateAssignmentInput,
    expectedRevision: number,
  ): Promise<Assignment> {
    const existing = this.assignments.get(assignmentId);
    if (!existing || existing.schoolId !== schoolId) {
      throw new Error("Not found");
    }
    if (existing.revision !== expectedRevision) {
      throw new Error("Conflict");
    }
    const updated: Assignment = {
      ...existing,
      ...(data.title ? { title: data.title } : {}),
      ...(data.startsAt ? { startsAt: data.startsAt } : {}),
      ...(data.dueAt ? { dueAt: data.dueAt } : {}),
      ...(data.offlineRequired !== undefined ? { offlineRequired: data.offlineRequired } : {}),
      revision: existing.revision + 1,
      updatedAt: new Date(),
    };
    this.assignments.set(assignmentId, updated);
    return updated;
  }

  async updateStatus(
    schoolId: string,
    assignmentId: string,
    status: AssignmentStatus,
    expectedRevision: number,
  ): Promise<Assignment> {
    const existing = this.assignments.get(assignmentId);
    if (!existing || existing.schoolId !== schoolId) {
      throw new Error("Not found");
    }
    if (existing.revision !== expectedRevision) {
      throw new Error("Conflict");
    }
    const updated: Assignment = {
      ...existing,
      status,
      ...(status === "OPEN" ? { openedAt: new Date() } : {}),
      ...(status === "CLOSED" ? { closedAt: new Date() } : {}),
      revision: existing.revision + 1,
      updatedAt: new Date(),
    };
    this.assignments.set(assignmentId, updated);
    return updated;
  }

  async softDelete(schoolId: string, assignmentId: string): Promise<void> {
    const existing = this.assignments.get(assignmentId);
    if (existing) {
      this.assignments.set(assignmentId, {
        ...existing,
        deletedAt: new Date(),
      });
    }
  }
}

function toSummary(a: Assignment): AssignmentSummary {
  return {
    id: a.id,
    schoolId: a.schoolId,
    title: a.title,
    status: a.status,
    startsAt: a.startsAt,
    dueAt: a.dueAt,
    revision: a.revision,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}
