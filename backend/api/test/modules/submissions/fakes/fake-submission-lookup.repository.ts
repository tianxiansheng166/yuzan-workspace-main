import type { SubmissionStatus, SubmissionSummary } from "../../../../src/modules/submissions/domain/submission.types.js";
import type { SubmissionLookupPort } from "../../../../src/modules/submissions/ports/submission-lookup.port.js";

export class FakeSubmissionLookupRepository implements SubmissionLookupPort {
  private readonly summaries = new Map<string, SubmissionSummary>();

  add(...items: SubmissionSummary[]): void {
    for (const s of items) {
      this.summaries.set(s.id, s);
    }
  }

  async findSummaryById(schoolId: string, submissionId: string): Promise<SubmissionSummary | null> {
    const item = this.summaries.get(submissionId);
    if (!item || item.schoolId !== schoolId) return null;
    return item;
  }

  async transitionStatus(
    schoolId: string,
    submissionId: string,
    to: SubmissionStatus,
    _expectedRevision: number,
  ): Promise<SubmissionSummary> {
    const item = this.summaries.get(submissionId);
    if (!item || item.schoolId !== schoolId) {
      throw new Error("Not found");
    }
    const updated: SubmissionSummary = {
      ...item,
      status: to,
      revision: item.revision + 1,
      ...(to === "SUBMITTED" ? { submittedAt: new Date() } : {}),
    };
    this.summaries.set(submissionId, updated);
    return updated;
  }
}
