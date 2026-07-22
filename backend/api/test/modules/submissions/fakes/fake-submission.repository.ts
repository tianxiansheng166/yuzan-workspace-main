import type {
  Submission,
  SubmissionSummary,
  CreateSubmissionInput,
  SubmissionStatus,
} from "../../../../src/modules/submissions/domain/submission.types.js";
import type {
  SubmissionRepositoryPort,
  ListSubmissionsOptions,
  PaginatedResult,
} from "../../../../src/modules/submissions/ports/submission-repository.port.js";

export class FakeSubmissionRepository implements SubmissionRepositoryPort {
  private readonly submissions = new Map<string, Submission>();
  private idCounter = 0;

  add(...items: Submission[]): void {
    for (const s of items) {
      this.submissions.set(s.id, s);
    }
  }

  async findById(schoolId: string, submissionId: string): Promise<Submission | null> {
    const item = this.submissions.get(submissionId);
    if (!item || item.schoolId !== schoolId) return null;
    return item;
  }

  async findByEnrollmentAndIdempotencyKey(
    enrollmentId: string,
    idempotencyKey: string,
  ): Promise<Submission | null> {
    for (const s of this.submissions.values()) {
      if (s.enrollmentId === enrollmentId && s.idempotencyKey === idempotencyKey) {
        return s;
      }
    }
    return null;
  }

  async listByAssignment(
    schoolId: string,
    assignmentId: string,
    options: ListSubmissionsOptions,
  ): Promise<PaginatedResult<SubmissionSummary>> {
    let all = Array.from(this.submissions.values()).filter(
      (s) => s.schoolId === schoolId && s.assignmentId === assignmentId,
    );
    if (options.status) {
      all = all.filter((s) => s.status === options.status);
    }
    const limit = options.limit;
    const start = options.cursor ? Number.parseInt(options.cursor, 10) : 0;
    const items = all.slice(start, start + limit).map(toSummary);
    const hasMore = all.length > start + limit;
    return { items, nextCursor: hasMore ? String(start + limit) : null, hasMore };
  }

  async listByEnrollment(
    schoolId: string,
    enrollmentId: string,
  ): Promise<readonly SubmissionSummary[]> {
    return Array.from(this.submissions.values())
      .filter((s) => s.schoolId === schoolId && s.enrollmentId === enrollmentId)
      .map(toSummary);
  }

  async save(input: CreateSubmissionInput): Promise<Submission> {
    const id = `submission-${++this.idCounter}`;
    const now = new Date();
    const attemptNo = await this.getNextAttemptNo(input.assignmentId, input.enrollmentId);
    const item: Submission = {
      id,
      schoolId: input.schoolId,
      assignmentId: input.assignmentId,
      enrollmentId: input.enrollmentId,
      attemptNo,
      status: "IN_PROGRESS",
      idempotencyKey: input.idempotencyKey,
      revision: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.submissions.set(id, item);
    return item;
  }

  async updateStatus(
    schoolId: string,
    submissionId: string,
    status: SubmissionStatus,
    expectedRevision: number,
  ): Promise<Submission> {
    const existing = this.submissions.get(submissionId);
    if (!existing || existing.schoolId !== schoolId) {
      throw new Error("Not found");
    }
    if (existing.revision !== expectedRevision) {
      throw new Error("Conflict");
    }
    const updated: Submission = {
      ...existing,
      status,
      revision: existing.revision + 1,
      ...(status === "SUBMITTED" ? { submittedAt: new Date() } : {}),
      updatedAt: new Date(),
    };
    this.submissions.set(submissionId, updated);
    return updated;
  }

  async getNextAttemptNo(assignmentId: string, enrollmentId: string): Promise<number> {
    const existing = Array.from(this.submissions.values()).filter(
      (s) => s.assignmentId === assignmentId && s.enrollmentId === enrollmentId,
    );
    return existing.length + 1;
  }
}

function toSummary(s: Submission): SubmissionSummary {
  return {
    id: s.id,
    schoolId: s.schoolId,
    assignmentId: s.assignmentId,
    enrollmentId: s.enrollmentId,
    attemptNo: s.attemptNo,
    status: s.status,
    revision: s.revision,
    ...(s.submittedAt ? { submittedAt: s.submittedAt } : {}),
    createdAt: s.createdAt,
  };
}
