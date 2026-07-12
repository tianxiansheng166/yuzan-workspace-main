import type {
  DataDeletionRequest,
  ListDeletionRequestsOptions,
  PaginatedResult,
} from "../domain/privacy.types.js";

export const DELETION_REPOSITORY = Symbol("DELETION_REPOSITORY");

export interface DeletionRequestRepositoryPort {
  list(options: ListDeletionRequestsOptions): Promise<PaginatedResult<DataDeletionRequest>>;
  findById(id: string): Promise<DataDeletionRequest | null>;
  save(request: DataDeletionRequest): Promise<DataDeletionRequest>;
}
