import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { ResourceLookupPort } from "./resource-lookup.port.js";
import type { Resource } from "../domain/resource.types.js";

@Injectable()
export class UnavailableResourceLookupAdapter implements ResourceLookupPort {
  exists(_schoolId: string | null, _resourceId: string): Promise<boolean> {
    void _schoolId;
    void _resourceId;
    return Promise.reject(
      new ServiceUnavailableException("Resource lookup is unavailable"),
    );
  }

  findByIds(_ids: readonly string[]): Promise<readonly Resource[]> {
    void _ids;
    return Promise.reject(
      new ServiceUnavailableException("Resource lookup is unavailable"),
    );
  }
}
