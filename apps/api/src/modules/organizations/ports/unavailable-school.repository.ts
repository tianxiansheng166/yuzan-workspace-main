import { Injectable } from "@nestjs/common";
import type { School, SchoolSummary } from "../domain/organization.types.js";
import { OrganizationUnavailableException } from "../domain/organization.errors.js";
import type { SchoolRepositoryPort } from "./school-repository.port.js";

@Injectable()
export class UnavailableSchoolRepository implements SchoolRepositoryPort {
  async findById(_schoolId: string): Promise<School | null> {
    throw new OrganizationUnavailableException();
  }

  async listActive(): Promise<readonly SchoolSummary[]> {
    throw new OrganizationUnavailableException();
  }
}
