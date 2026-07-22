import type { Resource } from "../domain/resource.types.js";

export const RESOURCE_LOOKUP_PORT = Symbol("RESOURCE_LOOKUP_PORT");

export interface ResourceLookupPort {
  exists(schoolId: string | null, resourceId: string): Promise<boolean>;
  findByIds(ids: readonly string[]): Promise<readonly Resource[]>;
}
