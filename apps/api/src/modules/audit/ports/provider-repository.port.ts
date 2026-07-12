import type {
  ProviderType,
  SystemProvider,
} from "../domain/provider.types.js";

export const PROVIDER_REPOSITORY = Symbol("PROVIDER_REPOSITORY");

export interface ProviderRepositoryPort {
  findById(id: string): Promise<SystemProvider | null>;
  list(type?: ProviderType, enabled?: boolean): Promise<readonly SystemProvider[]>;
  save(provider: SystemProvider): Promise<SystemProvider>;
  delete(id: string): Promise<boolean>;
}
