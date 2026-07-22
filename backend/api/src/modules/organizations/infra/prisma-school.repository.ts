import { Injectable } from "@nestjs/common";
import type { Prisma } from "@yuzan/database";
import { PrismaService } from "../../../shared/database/prisma.service.js";
import { OrganizationUnavailableException } from "../domain/organization.errors.js";
import type { School, SchoolSummary } from "../domain/organization.types.js";
import type { SchoolRepositoryPort } from "../ports/school-repository.port.js";

type SchoolRow = Prisma.SchoolGetPayload<Record<string, never>>;

@Injectable()
export class PrismaSchoolRepository implements SchoolRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(schoolId: string): Promise<School | null> {
    try {
      const row = await this.prisma.school.findFirst({
        where: { id: schoolId, isActive: true, deletedAt: null },
      });
      return row ? toSchool(row) : null;
    } catch {
      throw new OrganizationUnavailableException();
    }
  }

  async listActive(): Promise<readonly SchoolSummary[]> {
    try {
      const rows = await this.prisma.school.findMany({
        where: { isActive: true, deletedAt: null },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toSchoolSummary);
    } catch {
      throw new OrganizationUnavailableException();
    }
  }
}

function toSchool(row: SchoolRow): School {
  return {
    id: row.id,
    name: row.name,
    status: "ACTIVE",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toSchoolSummary(row: SchoolRow): SchoolSummary {
  return { id: row.id, name: row.name, status: "ACTIVE" };
}
