import type { Resource } from "../../../src/modules/resources/domain/resource.types.js";
import type { ResourceLookupPort } from "../../../src/modules/resources/ports/resource-lookup.port.js";

export class FakeResourceLookupAdapter implements ResourceLookupPort {
  private readonly resources = new Map<string, Resource>();

  add(...resources: Resource[]): void {
    for (const resource of resources) {
      this.resources.set(resource.id, resource);
    }
  }

  async exists(_schoolId: string | null, resourceId: string): Promise<boolean> {
    return this.resources.has(resourceId);
  }

  async findByIds(ids: readonly string[]): Promise<readonly Resource[]> {
    return ids
      .map((id) => this.resources.get(id))
      .filter((r): r is Resource => r !== undefined);
  }
}
