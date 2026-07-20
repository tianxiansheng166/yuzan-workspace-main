import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AuthContext } from "../../common/security/auth.types.js";
import { hasRole, MembershipRole } from "../../common/security/index.js";
import {
  RESOURCE_LOOKUP_PORT,
  type ResourceLookupPort,
} from "../resources/ports/resource-lookup.port.js";
import type {
  CourseVersion,
  CourseVersionSummary,
} from "./domain/course-version.types.js";
import {
  CurriculumConflictException,
  CurriculumForbiddenException,
  CurriculumNotFoundException,
} from "./domain/curriculum.errors.js";
import { CurriculumPolicy } from "./domain/curriculum.policy.js";
import { toSummary } from "./domain/course-version.types.js";
import type {
  CourseVersionRepositoryPort,
  ListCourseVersionsOptions,
} from "./ports/course-version-repository.port.js";
import { COURSE_VERSION_REPOSITORY } from "./ports/course-version-repository.port.js";
import { executePublish } from "./publishing/publishing.workflow.js";
import type { CreateCourseDraftDto } from "./dto/create-course-draft.dto.js";
import type { ListCourseVersionsQueryDto } from "./dto/list-course-versions-query.dto.js";
import type { UpdateCourseDraftDto } from "./dto/update-course-draft.dto.js";

@Injectable()
export class CurriculumService {
  private readonly policy = new CurriculumPolicy();

  constructor(
    @Inject(COURSE_VERSION_REPOSITORY)
    private readonly courseRepo: CourseVersionRepositoryPort,
    @Inject(RESOURCE_LOOKUP_PORT)
    private readonly resourceRepo: ResourceLookupPort,
  ) {}

  async listCourseVersions(
    auth: AuthContext,
    schoolId: string,
    query: ListCourseVersionsQueryDto,
  ): Promise<readonly CourseVersionSummary[]> {
    if (!this.policy.canReadList(auth)) {
      throw new CurriculumForbiddenException();
    }

    let status = query.status;

    if (this.isStudentOnly(auth)) {
      if (status && status !== "PUBLISHED") {
        throw new CurriculumForbiddenException("学生只能查看已发布课程");
      }
      status = "PUBLISHED";
    }

    const options: ListCourseVersionsOptions = {
      limit: query.limit,
      ...(status ? { status } : {}),
      ...(query.cursor ? { cursor: query.cursor } : {}),
    };

    const result = await this.courseRepo.list(schoolId, options);
    return result.items;
  }

  async createCourseDraft(
    auth: AuthContext,
    schoolId: string,
    dto: CreateCourseDraftDto,
  ): Promise<CourseVersionSummary> {
    if (!this.policy.canCreateDraft(auth, schoolId)) {
      throw new CurriculumForbiddenException();
    }

    const now = new Date();
    const courseId = randomUUID();

    const version: CourseVersion = {
      id: randomUUID(),
      schoolId,
      courseId,
      authorUserId: auth.principal.userId,
      version: 1,
      status: "DRAFT",
      title: dto.title,
      locale: dto.locale ?? "zh-CN",
      objectives: [],
      units: [],
      createdAt: now,
      updatedAt: now,
      ...(dto.description ? { description: dto.description } : {}),
      ...(dto.gradeBand ? { gradeBand: dto.gradeBand } : {}),
    };

    const saved = await this.courseRepo.save(version, {
      generateVersion: false,
    });
    return toSummary(saved);
  }

  async publishCourseVersion(
    auth: AuthContext,
    schoolId: string,
    courseVersionId: string,
  ): Promise<CourseVersionSummary> {
    const version = await this.courseRepo.findById(schoolId, courseVersionId);

    if (!version) {
      throw new CurriculumNotFoundException();
    }

    if (!this.policy.canPublish(auth, version)) {
      throw new CurriculumForbiddenException();
    }

    const published = await executePublish(
      this.courseRepo,
      this.resourceRepo,
      auth,
      schoolId,
      courseVersionId,
      new Date(),
    );

    return toSummary(published);
  }

  async updateDraft(
    auth: AuthContext,
    schoolId: string,
    courseVersionId: string,
    update: UpdateCourseDraftDto,
  ): Promise<CourseVersion> {
    const version = await this.courseRepo.findById(schoolId, courseVersionId);

    if (!version) {
      throw new CurriculumNotFoundException();
    }

    if (!this.policy.canManage(auth, version)) {
      throw new CurriculumForbiddenException();
    }

    if (version.status !== "DRAFT" && version.status !== "CHANGES_REQUESTED") {
      throw new CurriculumConflictException(
        `状态为 ${version.status} 的版本不可编辑，只能编辑 DRAFT 或 CHANGES_REQUESTED`,
      );
    }

    const updated: CourseVersion = {
      ...version,
      ...(update.title !== undefined ? { title: update.title } : {}),
      ...(update.description !== undefined
        ? { description: update.description }
        : {}),
      ...(update.gradeBand !== undefined ? { gradeBand: update.gradeBand } : {}),
      ...(update.locale !== undefined ? { locale: update.locale } : {}),
      ...(update.objectives !== undefined
        ? { objectives: update.objectives }
        : {}),
      ...(update.units !== undefined ? { units: update.units } : {}),
      id: version.id,
      schoolId: version.schoolId,
      courseId: version.courseId,
      authorUserId: version.authorUserId,
      version: version.version,
      status: "DRAFT",
      updatedAt: new Date(),
    };

    const saved = await this.courseRepo.save(updated, {
      generateVersion: false,
      expectedUpdatedAt: new Date(update.expectedUpdatedAt),
    });
    return saved;
  }

  async submitForReview(
    auth: AuthContext,
    schoolId: string,
    courseVersionId: string,
  ): Promise<CourseVersionSummary> {
    const version = await this.courseRepo.findById(schoolId, courseVersionId);

    if (!version) {
      throw new CurriculumNotFoundException();
    }

    if (!this.policy.canManage(auth, version)) {
      throw new CurriculumForbiddenException();
    }

    if (version.status !== "DRAFT" && version.status !== "CHANGES_REQUESTED") {
      throw new CurriculumConflictException(
        `只有 DRAFT 或 CHANGES_REQUESTED 状态可以提交审核`,
      );
    }

    const updated: CourseVersion = {
      ...version,
      status: "IN_REVIEW",
      submittedAt: new Date(),
      updatedAt: new Date(),
    };

    const saved = await this.courseRepo.save(updated, {
      generateVersion: false,
      expectedUpdatedAt: version.updatedAt,
    });
    return toSummary(saved);
  }

  async createNextVersionFromPublished(
    auth: AuthContext,
    schoolId: string,
    courseVersionId: string,
  ): Promise<CourseVersionSummary> {
    const version = await this.courseRepo.findById(schoolId, courseVersionId);

    if (!version) {
      throw new CurriculumNotFoundException();
    }

    if (!this.policy.canManage(auth, version)) {
      throw new CurriculumForbiddenException();
    }

    if (version.status !== "PUBLISHED") {
      throw new CurriculumConflictException(
        `只能从 PUBLISHED 版本创建新版本，当前状态为 ${version.status}`,
      );
    }

    const nextVersionNumber = await this.courseRepo.nextVersion(
      schoolId,
      version.courseId,
    );
    const now = new Date();

    const { submittedAt, approvedAt, publishedAt, retiredAt, ...rest } =
      version;

    const nextVersion: CourseVersion = {
      ...rest,
      id: randomUUID(),
      version: nextVersionNumber,
      status: "DRAFT",
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.courseRepo.save(nextVersion, {
      generateVersion: false,
    });
    return toSummary(saved);
  }

  async archiveCourseVersion(
    auth: AuthContext,
    schoolId: string,
    courseVersionId: string,
  ): Promise<CourseVersionSummary> {
    const version = await this.courseRepo.findById(schoolId, courseVersionId);

    if (!version) {
      throw new CurriculumNotFoundException();
    }

    if (!this.policy.canManage(auth, version)) {
      throw new CurriculumForbiddenException();
    }

    if (version.status !== "PUBLISHED") {
      throw new CurriculumConflictException(
        `只能归档已发布版本，当前状态为 ${version.status}`,
      );
    }

    const archived = await this.courseRepo.retire(
      schoolId,
      courseVersionId,
      new Date(),
    );

    if (!archived) {
      throw new CurriculumNotFoundException();
    }

    return toSummary(archived);
  }

  async findById(
    auth: AuthContext,
    schoolId: string,
    courseVersionId: string,
  ): Promise<CourseVersion> {
    const version = await this.courseRepo.findById(schoolId, courseVersionId);

    if (!version) {
      throw new CurriculumNotFoundException();
    }

    const isManager = this.policy.canManage(auth, version);
    const isStudentReader = this.policy.canReadAsStudent(auth, version);

    if (!isManager && !isStudentReader) {
      throw new CurriculumForbiddenException();
    }

    return version;
  }

  private isStudentOnly(auth: AuthContext): boolean {
    return (
      auth.principal.roles.length === 1 && hasRole(auth, MembershipRole.STUDENT)
    );
  }

  async attachResource(
    auth: AuthContext,
    schoolId: string,
    courseVersionId: string,
    dto: { resourceId: string; purpose: string; meta?: Record<string, unknown> },
  ) {
    const version = await this.courseRepo.findById(schoolId, courseVersionId);
    if (!version) {
      throw new CurriculumNotFoundException();
    }
    if (!this.policy.canManage(auth, version)) {
      throw new CurriculumForbiddenException();
    }

    // Verify the resource exists via the lookup port
    const resourceExists = await this.resourceRepo.exists(
      schoolId,
      dto.resourceId,
    );
    if (!resourceExists) {
      return {
        status: "PROVIDER_NOT_CONFIGURED" as const,
        message:
          "资源服务暂未配置，无法关联资源。请联系管理员配置资源服务后重试。",
        resourceId: dto.resourceId,
      };
    }

    // If the course version has a resources array, add to it
    const existingResources =
      (version as CourseVersion & { resources?: unknown[] }).resources ?? [];
    const newResource = {
      resourceId: dto.resourceId,
      purpose: dto.purpose,
      meta: dto.meta ?? {},
      attachedAt: new Date().toISOString(),
      attachedBy: auth.principal.userId,
    };

    const updated: CourseVersion = {
      ...version,
      updatedAt: new Date(),
    } as CourseVersion;
    (updated as CourseVersion & { resources?: unknown[] }).resources = [
      ...existingResources,
      newResource,
    ];

    await this.courseRepo.save(updated, { generateVersion: false });
    return newResource;
  }

  async listResources(
    auth: AuthContext,
    schoolId: string,
    courseVersionId: string,
  ) {
    const version = await this.courseRepo.findById(schoolId, courseVersionId);
    if (!version) {
      throw new CurriculumNotFoundException();
    }
    if (!this.policy.canManage(auth, version)) {
      throw new CurriculumForbiddenException();
    }

    const resources =
      (version as CourseVersion & { resources?: unknown[] }).resources ?? [];

    // If no resources attached, check if provider is available
    if (resources.length === 0) {
      const hasProvider = await this.resourceRepo.exists(schoolId, "");
      if (!hasProvider) {
        return {
          status: "PROVIDER_NOT_CONFIGURED" as const,
          items: [],
          message:
            "资源服务暂未配置，无法查询课程资源。请联系管理员配置资源服务。",
        };
      }
    }

    return { items: resources };
  }

  async attachOfflinePackage(
    auth: AuthContext,
    schoolId: string,
    courseVersionId: string,
    dto: { offlinePackageId: string },
  ) {
    const version = await this.courseRepo.findById(schoolId, courseVersionId);
    if (!version) {
      throw new CurriculumNotFoundException();
    }
    if (!this.policy.canManage(auth, version)) {
      throw new CurriculumForbiddenException();
    }

    // Offline package management is P2 — return PROVIDER_NOT_CONFIGURED
    return {
      status: "PROVIDER_NOT_CONFIGURED" as const,
      message:
        "离线资源包服务暂未配置，无法关联离线包。此功能将在后续版本中提供。",
      offlinePackageId: dto.offlinePackageId,
    };
  }
}
