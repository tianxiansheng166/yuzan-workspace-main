import type {
  ConsentVersion,
  ListConsentVersionsOptions,
  PaginatedResult,
} from "../domain/privacy.types.js";

export const CONSENT_REPOSITORY = Symbol("CONSENT_REPOSITORY");

export interface ConsentRepositoryPort {
  list(options: ListConsentVersionsOptions): Promise<PaginatedResult<ConsentVersion>>;
  findById(id: string): Promise<ConsentVersion | null>;
  findByPurposeAndVersion(purpose: string, version: number): Promise<ConsentVersion | null>;
  save(consent: ConsentVersion): Promise<ConsentVersion>;
}
