import type {
  AuditLogEntry,
  AuditSearchParams,
  AuditSearchResult,
} from "../../../src/modules/audit/domain/audit.types.js";
import type { AuditRepositoryPort } from "../../../src/modules/audit/ports/audit-repository.port.js";

export class FakeAuditRepository implements AuditRepositoryPort {
  private readonly entries = new Map<string, AuditLogEntry>();

  add(...entries: AuditLogEntry[]): void {
    for (const entry of entries) {
      this.entries.set(entry.id, entry);
    }
  }

  async search(params: AuditSearchParams): Promise<AuditSearchResult> {
    let items = Array.from(this.entries.values());

    if (params.schoolId) {
      items = items.filter((e) => e.schoolId === params.schoolId);
    }

    if (params.actorUserId) {
      items = items.filter((e) => e.actorUserId === params.actorUserId);
    }

    if (params.resourceType) {
      items = items.filter((e) => e.resourceType === params.resourceType);
    }

    if (params.resourceId) {
      items = items.filter((e) => e.resourceId === params.resourceId);
    }

    if (params.from) {
      items = items.filter((e) => e.createdAt >= params.from!);
    }

    if (params.to) {
      items = items.filter((e) => e.createdAt <= params.to!);
    }

    // Sort by createdAt descending for stable ordering
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Cursor-based pagination
    let startIndex = 0;
    if (params.cursor) {
      const cursorIndex = items.findIndex((e) => e.id === params.cursor);
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginated = items.slice(startIndex, startIndex + params.limit);
    const hasMore = startIndex + params.limit < items.length;
    const lastItem = paginated[paginated.length - 1];

    return {
      items: paginated,
      nextCursor: hasMore ? (lastItem?.id ?? null) : null,
      hasMore,
    };
  }

  async findById(
    _schoolId: string | null,
    id: string,
  ): Promise<AuditLogEntry | null> {
    return this.entries.get(id) ?? null;
  }
}
