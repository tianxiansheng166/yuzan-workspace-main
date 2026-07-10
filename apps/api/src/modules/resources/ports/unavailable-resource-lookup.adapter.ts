import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { ResourceLookupPort } from "./resource-lookup.port.js";
import type { Resource } from "../domain/resource.types.js";

@Injectable()
export class UnavailableResourceLookupAdapter implements ResourceLookupPort {
  async exists(
    _schoolId: string | null,
    _resourceId: string,
  ): Promise<boolean> {
    throw new ServiceUnavailableException("Resource lookup is unavailable");
  }

  async findByIds(_ids: readonly string[]): Promise<readonly Resource[]> {
    throw new ServiceUnavailableException("Resource lookup is unavailable");
  }
}
