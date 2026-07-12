import type { SystemProviderSecret } from "../../../src/modules/audit/domain/provider.types.js";
import type { ProviderSecretRepositoryPort } from "../../../src/modules/audit/ports/provider-secret-repository.port.js";

export class FakeProviderSecretRepository implements ProviderSecretRepositoryPort {
  private readonly secrets = new Map<string, SystemProviderSecret>();

  add(...secrets: SystemProviderSecret[]): void {
    for (const secret of secrets) {
      this.secrets.set(secret.id, secret);
    }
  }

  async findByProviderId(
    providerId: string,
  ): Promise<readonly SystemProviderSecret[]> {
    return Array.from(this.secrets.values()).filter(
      (s) => s.providerId === providerId,
    );
  }

  async save(secret: SystemProviderSecret): Promise<SystemProviderSecret> {
    this.secrets.set(secret.id, secret);
    return secret;
  }

  async delete(id: string): Promise<boolean> {
    return this.secrets.delete(id);
  }
}
