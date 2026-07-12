import { Injectable } from "@nestjs/common";
import type { Prisma } from "@yuzan/database";
import { PrismaService } from "../../../shared/database/prisma.service.js";
import {
  AdminConflictException,
  AdminUnavailableException,
} from "../domain/admin.errors.js";
import type { AdminSchool, SchoolUsageStats } from "../domain/admin.types.js";
import type {
  AdminSchoolListOptions,
  AdminSchoolListResult,
  AdminSchoolRepositoryPort,
} from "../ports/admin-school-repository.port.js";

type SchoolRow = Prisma.SchoolGetPayload<Record<string, never>>;

@Injectable()
export class PrismaAdminSchoolRepository
  implements AdminSchoolRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {}

  async list(options: AdminSchoolListOptions): Promise<AdminSchoolListResult> {
    try {
      const where: Prisma.SchoolWhereInput = { deletedAt: null };
      if (options.isActive !== undefined) {
        where.isActive = options.isActive;
      }
      if (options.search) {
        where.OR = [
          { name: { contains: options.search, mode: "insensitive" } },
          { code: { contains: options.search, mode: "insensitive" } },
        ];
      }

      const take = options.limit;
      const skip = options.cursor ? 1 : 0;
      const cursor = options.cursor
        ? ({ id: options.cursor } satisfies Prisma.SchoolWhereUniqueInput)
        : undefined;

      const rows = await this.prisma.school.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: take + 1,
        skip,
        ...(cursor ? { cursor } : {}),
      });

      const hasMore = rows.length > take;
      const items = rows.slice(0, take).map(toAdminSchool);
      const lastItem = items[items.length - 1];

      return {
        items,
        nextCursor: hasMore ? (lastItem?.id ?? null) : null,
        hasMore,
      };
    } catch (err) {
      if (err instanceof AdminUnavailableException) throw err;
      throw new AdminUnavailableException();
    }
  }

  async findById(id: string): Promise<AdminSchool | null> {
    try {
      const row = await this.prisma.school.findUnique({ where: { id } });
      return row ? toAdminSchool(row) : null;
    } catch (err) {
      if (err instanceof AdminUnavailableException) throw err;
      throw new AdminUnavailableException();
    }
  }

  async save(school: AdminSchool): Promise<AdminSchool> {
    try {
      const data: Prisma.SchoolUncheckedCreateInput = {
        id: school.id,
        code: school.code,
        name: school.name,
        timezone: school.timezone,
        regionCode: school.regionCode ?? null,
        isActive: school.isActive,
        planId: school.planId ?? null,
      };

      const existing = await this.prisma.school.findUnique({
        where: { id: school.id },
      });

      const row = existing
        ? await this.prisma.school.update({
            where: { id: school.id },
            data: {
              code: data.code,
              name: data.name,
              timezone: data.timezone,
              regionCode: data.regionCode,
              isActive: data.isActive,
              planId: data.planId,
            } as Prisma.SchoolUncheckedUpdateInput,
          })
        : await this.prisma.school.create({ data });

      return toAdminSchool(row);
    } catch (err) {
      if (err instanceof AdminUnavailableException) throw err;
      throw new AdminUnavailableException();
    }
  }

  async activate(id: string): Promise<AdminSchool | null> {
    try {
      const existing = await this.prisma.school.findUnique({ where: { id } });
      if (!existing) return null;
      if (existing.isActive) {
        throw new AdminConflictException("学校已经是启用状态");
      }
      const row = await this.prisma.school.update({
        where: { id },
        data: { isActive: true },
      });
      return toAdminSchool(row);
    } catch (err) {
      if (
        err instanceof AdminConflictException ||
        err instanceof AdminUnavailableException
      ) {
        throw err;
      }
      throw new AdminUnavailableException();
    }
  }

  async deactivate(id: string): Promise<AdminSchool | null> {
    try {
      const existing = await this.prisma.school.findUnique({ where: { id } });
      if (!existing) return null;
      if (!existing.isActive) {
        throw new AdminConflictException("学校已经是停用状态");
      }
      const row = await this.prisma.school.update({
        where: { id },
        data: { isActive: false },
      });
      return toAdminSchool(row);
    } catch (err) {
      if (
        err instanceof AdminConflictException ||
        err instanceof AdminUnavailableException
      ) {
        throw err;
      }
      throw new AdminUnavailableException();
    }
  }

  async archive(id: string): Promise<AdminSchool | null> {
    try {
      const existing = await this.prisma.school.findUnique({ where: { id } });
      if (!existing) return null;
      const row = await this.prisma.school.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return toAdminSchool(row);
    } catch (err) {
      if (err instanceof AdminUnavailableException) throw err;
      throw new AdminUnavailableException();
    }
  }

  async assignPlan(
    schoolId: string,
    planId: string,
  ): Promise<AdminSchool | null> {
    try {
      const existing = await this.prisma.school.findUnique({
        where: { id: schoolId },
      });
      if (!existing) return null;
      const row = await this.prisma.school.update({
        where: { id: schoolId },
        data: { planId },
      });
      return toAdminSchool(row);
    } catch (err) {
      if (err instanceof AdminUnavailableException) throw err;
      throw new AdminUnavailableException();
    }
  }

  async getUsageStats(_schoolId: string): Promise<SchoolUsageStats> {
    try {
      const [
        membershipCount,
        classCount,
        courseCount,
        assignmentCount,
        submissionCount,
      ] = await Promise.all([
        this.prisma.membership.count({ where: { schoolId: _schoolId } }),
        this.prisma.class.count({ where: { schoolId: _schoolId } }),
        this.prisma.course.count({ where: { schoolId: _schoolId } }),
        this.prisma.assignment.count({ where: { schoolId: _schoolId } }),
        this.prisma.submission.count({ where: { schoolId: _schoolId } }),
      ]);

      return {
        membershipCount,
        classCount,
        courseCount,
        assignmentCount,
        submissionCount,
      };
    } catch (err) {
      if (err instanceof AdminUnavailableException) throw err;
      throw new AdminUnavailableException();
    }
  }

  async hasBusinessData(schoolId: string): Promise<boolean> {
    try {
      const counts = await Promise.all([
        this.prisma.membership.count({ where: { schoolId } }),
        this.prisma.class.count({ where: { schoolId } }),
        this.prisma.course.count({ where: { schoolId } }),
        this.prisma.assignment.count({ where: { schoolId } }),
        this.prisma.submission.count({ where: { schoolId } }),
      ]);
      return counts.some((c) => c > 0);
    } catch (err) {
      if (err instanceof AdminUnavailableException) throw err;
      throw new AdminUnavailableException();
    }
  }
}

function toAdminSchool(row: SchoolRow): AdminSchool {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    timezone: row.timezone,
    regionCode: row.regionCode ?? null,
    isActive: row.isActive,
    planId: row.planId ?? null,
    planTier: null,
    membershipCount: 0,
    classCount: 0,
    courseCount: 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
  };
}
