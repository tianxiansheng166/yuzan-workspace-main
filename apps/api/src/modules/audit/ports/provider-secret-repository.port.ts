import type { SystemProviderSecret } from "../domain/provider.types.js";

export const PROVIDER_SECRET_REPOSITORY = Symbol("PROVIDER_SECRET_REPOSITORY");

export interface ProviderSecretRepositoryPort {
  findByProviderId(providerId: string): Promise<readonly SystemProviderSecret[]>;
  save(secret: SystemProviderSecret): Promise<SystemProviderSecret>;
  delete(id: string): Promise<boolean>;
}
