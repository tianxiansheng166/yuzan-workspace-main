import type { Feedback, CreateFeedbackInput } from "../../../../src/modules/feedback/domain/feedback.types.js";
import type {
  FeedbackRepositoryPort,
  ListPendingFeedbackOptions,
  PaginatedResult,
} from "../../../../src/modules/feedback/ports/feedback-repository.port.js";

export class FakeFeedbackRepository implements FeedbackRepositoryPort {
  private readonly feedbacks = new Map<string, Feedback>();
  private idCounter = 0;

  add(...items: Feedback[]): void {
    for (const f of items) {
      this.feedbacks.set(f.id, f);
    }
  }

  async findById(schoolId: string, feedbackId: string): Promise<Feedback | null> {
    const item = this.feedbacks.get(feedbackId);
    if (!item || item.schoolId !== schoolId) return null;
    return item;
  }

  async findBySubmissionId(schoolId: string, submissionId: string): Promise<readonly Feedback[]> {
    return Array.from(this.feedbacks.values()).filter(
      (f) => f.schoolId === schoolId && f.submissionId === submissionId,
    );
  }

  async findPendingBySchool(
    schoolId: string,
    options: ListPendingFeedbackOptions,
  ): Promise<PaginatedResult<Feedback>> {
    const all = Array.from(this.feedbacks.values()).filter(
      (f) => f.schoolId === schoolId,
    );
    const limit = options.limit;
    const start = options.cursor ? Number.parseInt(options.cursor, 10) : 0;
    const items = all.slice(start, start + limit);
    const hasMore = all.length > start + limit;
    return { items, nextCursor: hasMore ? String(start + limit) : null, hasMore };
  }

  async save(input: CreateFeedbackInput): Promise<Feedback> {
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
    return item;
  }
}
