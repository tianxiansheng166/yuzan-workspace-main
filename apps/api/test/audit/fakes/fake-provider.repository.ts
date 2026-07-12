import type {
  ProviderType,
  SystemProvider,
} from "../../../src/modules/audit/domain/provider.types.js";
import type { ProviderRepositoryPort } from "../../../src/modules/audit/ports/provider-repository.port.js";

export class FakeProviderRepository implements ProviderRepositoryPort {
  private readonly providers = new Map<string, SystemProvider>();

  add(...providers: SystemProvider[]): void {
    for (const provider of providers) {
      this.providers.set(provider.id, provider);
    }
  }

  async findAll(): Promise<readonly SystemProvider[]> {
    return Array.from(this.providers.values());
  }

  async findById(id: string): Promise<SystemProvider | null> {
    return this.providers.get(id) ?? null;
  }

  async list(
    type?: ProviderType,
    enabled?: boolean,
  ): Promise<readonly SystemProvider[]> {
    let items = Array.from(this.providers.values());
    if (type) {
      items = items.filter((p) => p.type === type);
    }
    if (enabled !== undefined) {
      items = items.filter((p) => p.enabled === enabled);
    }
    return items;
  }

  async save(provider: SystemProvider): Promise<SystemProvider> {
    this.providers.set(provider.id, provider);
    return provider;
  }

  async delete(id: string): Promise<boolean> {
    return this.providers.delete(id);
  }
}
