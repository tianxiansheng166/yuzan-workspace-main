import type {
  DataDeletionRequest,
  DeletionRequestStatus,
  ListDeletionRequestsOptions,
  PaginatedResult,
} from "../../../src/modules/privacy/domain/privacy.types.js";
import type { DeletionRequestRepositoryPort } from "../../../src/modules/privacy/ports/deletion-repository.port.js";

export class FakeDeletionRepository implements DeletionRequestRepositoryPort {
  private readonly requests = new Map<string, DataDeletionRequest>();

  add(...requests: DataDeletionRequest[]): void {
    for (const request of requests) {
      this.requests.set(request.id, request);
    }
  }

  async list(
    options: ListDeletionRequestsOptions,
  ): Promise<PaginatedResult<DataDeletionRequest>> {
    let all = Array.from(this.requests.values()).sort(
      (a, b) => b.requestedAt.getTime() - a.requestedAt.getTime(),
    );

    if (options.status) {
      all = all.filter((r) => r.status === (options.status as DeletionRequestStatus));
    }
    if (options.userId) {
      all = all.filter((r) => r.userId === options.userId);
    }
    if (options.schoolId) {
      all = all.filter((r) => r.schoolId === options.schoolId);
    }

    const limit = options.limit;
    const start = options.cursor ? parseInt(options.cursor, 10) : 0;
    const items = all.slice(start, start + limit);
    const hasMore = all.length > start + limit;
    const nextCursor = hasMore ? String(start + limit) : null;

    return { items, nextCursor, hasMore };
  }

  async findById(id: string): Promise<DataDeletionRequest | null> {
    return this.requests.get(id) ?? null;
  }

  async save(request: DataDeletionRequest): Promise<DataDeletionRequest> {
    this.requests.set(request.id, request);
    return request;
  }
}
