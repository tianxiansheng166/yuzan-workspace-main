import { Injectable } from "@nestjs/common";
import type { GovernanceCourseVersion } from "../domain/governance.types.js";
import { GovernanceNotFoundException } from "../domain/governance.errors.js";
import type {
  GovernanceRepositoryPort,
} from "./governance-repository.port.js";
import type { GovernanceVersionListResult, ListGovernanceVersionsOptions } from "../domain/governance.types.js";
import type { CourseVersionStatus } from "../../curriculum/domain/course-version.types.js";

@Injectable()
export class UnavailableGovernanceRepository implements GovernanceRepositoryPort {
  private fail(): never {
    throw new GovernanceNotFoundException("课程治理服务暂不可用");
  }

  async listAll(
    _options: ListGovernanceVersionsOptions,
  ): Promise<GovernanceVersionListResult> {
    this.fail();
  }

  async findById(
    _schoolId: string,
    _id: string,
  ): Promise<GovernanceCourseVersion | null> {
    this.fail();
  }

  async updateStatus(
    _schoolId: string,
    _id: string,
    _status: CourseVersionStatus,
    _timestampFields: Record<string, Date>,
    _expectedUpdatedAt: Date,
  ): Promise<GovernanceCourseVersion> {
    this.fail();
  }

  async findByIdPlatformWide(
    _id: string,
  ): Promise<GovernanceCourseVersion | null> {
    this.fail();
  }
}
