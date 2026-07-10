import { Inject, Injectable } from "@nestjs/common";
import {
  MembershipRole,
  MembershipStatus,
} from "../../../common/security/index.js";
import {
  OrganizationUnavailableException,
  OrganizationNotFoundException,
} from "../domain/organization.errors.js";
import type { School, SchoolSummary } from "../domain/organization.types.js";
import type { SchoolRepositoryPort } from "../ports/school-repository.port.js";
import { PrismaService } from "./prisma/prisma.service.js";
import type { School as PrismaSchool } from "./prisma/generated/client.js";

@Injectable()
export class PrismaSchoolRepository implements SchoolRepositoryPort {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async findById(schoolId: string): Promise<School | null> {
    try {
      const row = await this.prisma.school.findUnique({
        where: { id: schoolId },
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

function toSchool(row: PrismaSchool): School {
  return {
    id: row.id,
    name: row.name,
    status: row.isActive ? "ACTIVE" : "INACTIVE",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toSchoolSummary(row: PrismaSchool): SchoolSummary {
  return {
    id: row.id,
    name: row.name,
    status: row.isActive ? "ACTIVE" : "INACTIVE",
  };
}
