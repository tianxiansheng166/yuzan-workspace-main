import type {
  ConsentVersion,
  ListConsentVersionsOptions,
  PaginatedResult,
} from "../../../src/modules/privacy/domain/privacy.types.js";
import type { ConsentRepositoryPort } from "../../../src/modules/privacy/ports/consent-repository.port.js";

export class FakeConsentRepository implements ConsentRepositoryPort {
  private readonly consents = new Map<string, ConsentVersion>();

  add(...consents: ConsentVersion[]): void {
    for (const consent of consents) {
      this.consents.set(consent.id, consent);
    }
  }

  async list(
    options: ListConsentVersionsOptions,
  ): Promise<PaginatedResult<ConsentVersion>> {
    let all = Array.from(this.consents.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    if (options.purpose) {
      all = all.filter((c) => c.purpose === options.purpose);
    }

    const limit = options.limit;
    const start = options.cursor ? parseInt(options.cursor, 10) : 0;
    const items = all.slice(start, start + limit);
    const hasMore = all.length > start + limit;
    const nextCursor = hasMore ? String(start + limit) : null;

    return { items, nextCursor, hasMore };
  }

  async findById(id: string): Promise<ConsentVersion | null> {
    return this.consents.get(id) ?? null;
  }

  async findByPurposeAndVersion(
    purpose: string,
    version: number,
  ): Promise<ConsentVersion | null> {
    for (const consent of this.consents.values()) {
      if (consent.purpose === purpose && consent.version === version) {
        return consent;
      }
    }
    return null;
  }

  async save(consent: ConsentVersion): Promise<ConsentVersion> {
    this.consents.set(consent.id, consent);
    return consent;
  }
}
