import type {
  Feedback,
  CreateFeedbackInput,
} from "../../../../src/modules/feedback/domain/feedback.types.js";
import type {
  FeedbackRepositoryPort,
  ListPendingFeedbackOptions,
  PaginatedResult,
} from "../../../../src/modules/feedback/ports/feedback-repository.port.js";

export class FakeFeedbackRepository implements FeedbackRepositoryPort {
  private readonly feedbacks = new Map<string, Feedback>();
  private idCounter = 0;
  readonly submissionQueries: Array<{
    schoolId: string;
    submissionId: string;
  }> = [];
  readonly pendingQueries: Array<{
    schoolId: string;
    options: ListPendingFeedbackOptions;
  }> = [];

  add(...items: Feedback[]): void {
    for (const f of items) {
      this.feedbacks.set(f.id, f);
    }
  }

  findById(schoolId: string, feedbackId: string): Promise<Feedback | null> {
    const item = this.feedbacks.get(feedbackId);
    return Promise.resolve(!item || item.schoolId !== schoolId ? null : item);
  }

  findBySubmissionId(
    schoolId: string,
    submissionId: string,
  ): Promise<readonly Feedback[]> {
    this.submissionQueries.push({ schoolId, submissionId });
    return Promise.resolve(
      Array.from(this.feedbacks.values()).filter(
        (f) => f.schoolId === schoolId && f.submissionId === submissionId,
      ),
    );
  }

  findPendingBySchool(
    schoolId: string,
    options: ListPendingFeedbackOptions,
  ): Promise<PaginatedResult<Feedback>> {
    this.pendingQueries.push({ schoolId, options: { ...options } });
    const all = Array.from(this.feedbacks.values()).filter(
      (f) => f.schoolId === schoolId,
    );
    const limit = options.limit;
    const start = options.cursor ? Number.parseInt(options.cursor, 10) : 0;
    const items = all.slice(start, start + limit);
    const hasMore = all.length > start + limit;
    return Promise.resolve({
      items,
      nextCursor: hasMore ? String(start + limit) : null,
      hasMore,
    });
  }

  save(input: CreateFeedbackInput): Promise<Feedback> {
    const id = `feedback-${++this.idCounter}`;
    const item: Feedback = {
      id,
      schoolId: input.schoolId,
      submissionId: input.submissionId,
      authorUserId: input.authorUserId,
      decision: input.decision,
      comment: input.comment,
      ...(input.score !== undefined ? { score: input.score } : {}),
      revision: 1,
      releasedAt: new Date(),
    };
    this.feedbacks.set(id, item);
    return Promise.resolve(item);
  }
}
