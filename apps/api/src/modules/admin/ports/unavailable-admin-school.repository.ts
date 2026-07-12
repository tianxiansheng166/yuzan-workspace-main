import { Injectable } from "@nestjs/common";
import type {
  AdminSchool,
  SchoolUsageStats,
} from "../domain/admin.types.js";
import { AdminUnavailableException } from "../domain/admin.errors.js";
import type {
  AdminSchoolListOptions,
  AdminSchoolListResult,
  AdminSchoolRepositoryPort,
} from "./admin-school-repository.port.js";

@Injectable()
export class UnavailableAdminSchoolRepository
  implements AdminSchoolRepositoryPort
{
  async list(_options: AdminSchoolListOptions): Promise<AdminSchoolListResult> {
    throw new AdminUnavailableException();
  }

  async findById(_id: string): Promise<AdminSchool | null> {
    throw new AdminUnavailableException();
  }

  async save(_school: AdminSchool): Promise<AdminSchool> {
    throw new AdminUnavailableException();
  }

  async activate(_id: string): Promise<AdminSchool | null> {
    throw new AdminUnavailableException();
  }

  async deactivate(_id: string): Promise<AdminSchool | null> {
    throw new AdminUnavailableException();
  }

  async archive(_id: string): Promise<AdminSchool | null> {
    throw new AdminUnavailableException();
  }

  async assignPlan(
    _schoolId: string,
    _planId: string,
  ): Promise<AdminSchool | null> {
    throw new AdminUnavailableException();
  }

  async getUsageStats(_schoolId: string): Promise<SchoolUsageStats> {
    throw new AdminUnavailableException();
  }

  async hasBusinessData(_schoolId: string): Promise<boolean> {
    throw new AdminUnavailableException();
  }
}
