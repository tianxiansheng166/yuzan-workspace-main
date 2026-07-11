import type {
  ActivityProgressRecord,
  UpdateProgressInput,
} from "../../../../src/modules/learning/domain/learning.types.js";
import type { LearningRepositoryPort } from "../../../../src/modules/learning/ports/learning-repository.port.js";

export class FakeLearningRepository implements LearningRepositoryPort {
  private readonly progress = new Map<string, ActivityProgressRecord>();

  add(...items: ActivityProgressRecord[]): void {
    for (const p of items) {
      const key = `${p.activityId}:${p.enrollmentId}`;
      this.progress.set(key, p);
    }
  }

  async findProgress(activityId: string, enrollmentId: string): Promise<ActivityProgressRecord | null> {
    return this.progress.get(`${activityId}:${enrollmentId}`) ?? null;
  }

  async upsertProgress(input: UpdateProgressInput): Promise<ActivityProgressRecord> {
    const key = `${input.activityId}:${input.enrollmentId}`;
    const existing = this.progress.get(key);
    const now = new Date();

    if (existing) {
      const updated: ActivityProgressRecord = {
        ...existing,
        position: input.position,
        completed: input.completed,
        revision: existing.revision + 1,
        updatedAt: now,
      };
      this.progress.set(key, updated);
      return updated;
    }

    const record: ActivityProgressRecord = {
      id: `progress-${this.progress.size + 1}`,
      schoolId: input.schoolId,
      activityId: input.activityId,
      enrollmentId: input.enrollmentId,
      position: input.position,
      completed: input.completed,
      revision: 1,
      updatedAt: now,
    };
    this.progress.set(key, record);
    return record;
  }

  async listProgressByEnrollment(enrollmentId: string): Promise<readonly ActivityProgressRecord[]> {
    return Array.from(this.progress.values()).filter(
      (p) => p.enrollmentId === enrollmentId,
    );
  }
}
