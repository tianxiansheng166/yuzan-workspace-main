import type {
  AssessmentLink,
  ListLinksOptions,
  PaginatedResult,
} from "../../../src/modules/product-plans/domain/link.types.js";
import type { LinkRepositoryPort } from "../../../src/modules/product-plans/ports/link-repository.port.js";

export class FakeLinkRepository implements LinkRepositoryPort {
  private readonly links = new Map<string, AssessmentLink>();

  add(...links: AssessmentLink[]): void {
    for (const link of links) {
      this.links.set(link.id, link);
    }
  }

  async list(options: ListLinksOptions): Promise<PaginatedResult<AssessmentLink>> {
    let all = Array.from(this.links.values());

    all = all.filter((l) => l.schoolId === options.schoolId);

    if (options.assignmentId !== undefined) {
      all = all.filter((l) => l.assignmentId === options.assignmentId);
    }

    if (options.status !== undefined) {
      all = all.filter((l) => l.status === options.status);
    }

    all.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const limit = options.limit;
    const start = options.cursor ? parseInt(options.cursor, 10) : 0;
    const items = all.slice(start, start + limit);
    const hasMore = all.length > start + limit;
    const nextCursor = hasMore ? String(start + limit) : null;

    return { items, nextCursor, hasMore };
  }

  async findById(schoolId: string, id: string): Promise<AssessmentLink | null> {
    const link = this.links.get(id);
    if (!link || link.schoolId !== schoolId) {
      return null;
    }
    return link;
  }

  async save(link: AssessmentLink): Promise<AssessmentLink> {
    this.links.set(link.id, link);
    return link;
  }

  async incrementUsageCount(_schoolId: string, id: string): Promise<void> {
    const link = this.links.get(id);
    if (!link) {
      return;
    }

    const updated: AssessmentLink = {
      ...link,
      usageCount: link.usageCount + 1,
      updatedAt: new Date(),
    };
    this.links.set(id, updated);
  }
}
