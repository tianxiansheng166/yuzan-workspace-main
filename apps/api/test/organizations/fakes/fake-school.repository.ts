import type {
  School,
  SchoolSummary,
} from "../../../src/modules/organizations/domain/organization.types.js";
import type { SchoolRepositoryPort } from "../../../src/modules/organizations/ports/school-repository.port.js";

export class FakeSchoolRepository implements SchoolRepositoryPort {
  private readonly schools = new Map<string, School>();

  add(...schools: School[]): void {
    for (const school of schools) {
      this.schools.set(school.id, school);
    }
  }

  async findById(schoolId: string): Promise<School | null> {
    return this.schools.get(schoolId) ?? null;
  }

  async listActive(): Promise<readonly SchoolSummary[]> {
    return Array.from(this.schools.values())
      .filter((s) => s.status === "ACTIVE")
      .map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
      }));
  }
}
