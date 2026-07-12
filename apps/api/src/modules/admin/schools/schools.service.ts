import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AuthContext } from "../../../common/security/auth.types.js";
import {
  AdminConflictException,
  AdminForbiddenException,
  AdminNotFoundException,
} from "../domain/admin.errors.js";
import type { AdminSchool } from "../domain/admin.types.js";
import type {
  AdminSchoolListOptions,
  AdminSchoolRepositoryPort,
} from "../ports/admin-school-repository.port.js";
import { ADMIN_SCHOOL_REPOSITORY } from "../ports/admin-school-repository.port.js";
import type { AdminMetricsPort } from "../ports/admin-metrics.port.js";
import { ADMIN_METRICS_PORT } from "../ports/admin-metrics.port.js";
import {
  toAdminSchoolResponse,
  toSchoolUsageStatsResponse,
} from "../dto/admin-school.response.js";
import type { CreateSchoolDto } from "../dto/create-school.dto.js";
import type { UpdateSchoolDto } from "../dto/update-school.dto.js";
import { AdminSchoolsPolicy } from "./schools.policy.js";

@Injectable()
export class SchoolsService {
  private readonly policy = new AdminSchoolsPolicy();

  constructor(
    @Inject(ADMIN_SCHOOL_REPOSITORY)
    private readonly schoolRepo: AdminSchoolRepositoryPort,
    @Inject(ADMIN_METRICS_PORT)
    private readonly metricsPort: AdminMetricsPort,
  ) {}

  async list(auth: AuthContext, options: AdminSchoolListOptions) {
    if (!this.policy.canViewAllSchools(auth)) {
      throw new AdminForbiddenException();
    }

    const result = await this.schoolRepo.list(options);
    return {
      items: result.items.map(toAdminSchoolResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async findById(auth: AuthContext, schoolId: string) {
    if (!this.policy.canViewAllSchools(auth)) {
      throw new AdminForbiddenException();
    }

    const school = await this.schoolRepo.findById(schoolId);
    if (!school) {
      throw new AdminNotFoundException("学校");
    }

    return toAdminSchoolResponse(school);
  }

  async create(auth: AuthContext, dto: CreateSchoolDto) {
    if (!this.policy.canManageSchools(auth)) {
      throw new AdminForbiddenException();
    }

    const now = new Date();
    const school: AdminSchool = {
      id: randomUUID(),
      code: dto.code,
      name: dto.name,
      timezone: dto.timezone ?? "Asia/Shanghai",
      regionCode: dto.regionCode ?? null,
      isActive: true,
      planId: null,
      planTier: null,
      membershipCount: 0,
      classCount: 0,
      courseCount: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    const saved = await this.schoolRepo.save(school);
    return toAdminSchoolResponse(saved);
  }

  async update(auth: AuthContext, schoolId: string, dto: UpdateSchoolDto) {
    if (!this.policy.canManageSchools(auth)) {
      throw new AdminForbiddenException();
    }

    const existing = await this.schoolRepo.findById(schoolId);
    if (!existing) {
      throw new AdminNotFoundException("学校");
    }

    const expectedUpdatedAt = new Date(dto.expectedUpdatedAt).getTime();
    if (existing.updatedAt.getTime() !== expectedUpdatedAt) {
      throw new AdminConflictException(
        "学校数据已被修改，请刷新后重试",
      );
    }

    const updated: AdminSchool = {
      ...existing,
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
      ...(dto.regionCode !== undefined
        ? { regionCode: dto.regionCode }
        : {}),
      updatedAt: new Date(),
    };

    const saved = await this.schoolRepo.save(updated);
    return toAdminSchoolResponse(saved);
  }

  async activate(auth: AuthContext, schoolId: string) {
    if (!this.policy.canManageSchools(auth)) {
      throw new AdminForbiddenException();
    }

    const school = await this.schoolRepo.activate(schoolId);
    if (!school) {
      throw new AdminNotFoundException("学校");
    }

    return toAdminSchoolResponse(school);
  }

  async deactivate(auth: AuthContext, schoolId: string) {
    if (!this.policy.canManageSchools(auth)) {
      throw new AdminForbiddenException();
    }

    const school = await this.schoolRepo.deactivate(schoolId);
    if (!school) {
      throw new AdminNotFoundException("学校");
    }

    return toAdminSchoolResponse(school);
  }

  async archive(auth: AuthContext, schoolId: string) {
    if (!this.policy.canArchiveSchool(auth)) {
      throw new AdminForbiddenException();
    }

    const existing = await this.schoolRepo.findById(schoolId);
    if (!existing) {
      throw new AdminNotFoundException("学校");
    }

    const hasData = await this.schoolRepo.hasBusinessData(schoolId);
    if (hasData) {
      throw new AdminConflictException(
        "学校存在业务数据，无法归档。请先停用学校并迁移数据。",
      );
    }

    const school = await this.schoolRepo.archive(schoolId);
    if (!school) {
      throw new AdminNotFoundException("学校");
    }

    return toAdminSchoolResponse(school);
  }

  async assignPlan(auth: AuthContext, schoolId: string, planId: string) {
    if (!this.policy.canAssignPlan(auth)) {
      throw new AdminForbiddenException();
    }

    const existing = await this.schoolRepo.findById(schoolId);
    if (!existing) {
      throw new AdminNotFoundException("学校");
    }

    const school = await this.schoolRepo.assignPlan(schoolId, planId);
    if (!school) {
      throw new AdminNotFoundException("学校");
    }

    return toAdminSchoolResponse(school);
  }

  async getUsageStats(auth: AuthContext, schoolId: string) {
    if (!this.policy.canViewAllSchools(auth)) {
      throw new AdminForbiddenException();
    }

    const existing = await this.schoolRepo.findById(schoolId);
    if (!existing) {
      throw new AdminNotFoundException("学校");
    }

    const stats = await this.metricsPort.getSchoolUsageStats(schoolId);
    return toSchoolUsageStatsResponse(stats);
  }
}
