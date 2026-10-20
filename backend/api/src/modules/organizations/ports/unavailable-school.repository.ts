import { Injectable } from "@nestjs/common";
import type { School, SchoolSummary } from "../domain/organization.types.js";
import { OrganizationUnavailableException } from "../domain/organization.errors.js";
import type { SchoolRepositoryPort } from "./school-repository.port.js";

@Injectable()
export class UnavailableSchoolRepository implements SchoolRepositoryPort {
  findById(_schoolId: string): Promise<School | null> {
    void _schoolId;
    return Promise.reject(new OrganizationUnavailableException());
  }

  listActive(): Promise<readonly SchoolSummary[]> {
    return Promise.reject(new OrganizationUnavailableException());
  }
}
