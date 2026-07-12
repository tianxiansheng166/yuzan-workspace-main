import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AuthContext } from "../../../common/security/auth.types.js";
import type {
  AssessmentMaterial,
  AssessmentMaterialStatus,
  ListMaterialsOptions,
} from "../domain/assessment.types.js";
import {
  MaterialNotFoundException,
  MaterialConflictException,
  MaterialVersionConflictException,
} from "../domain/assessment.errors.js";
import { AssessmentPolicy } from "../domain/assessment.policy.js";
import { ASSESSMENT_MATERIAL_REPOSITORY } from "../ports/assessment-material-repository.port.js";
import type { AssessmentMaterialRepositoryPort } from "../ports/assessment-material-repository.port.js";
import { toMaterialResponse } from "../dto/material.response.js";
import type { CreateMaterialDto } from "../dto/create-material.dto.js";
import type { UpdateMaterialDto } from "../dto/update-material.dto.js";

@Injectable()
export class AssessmentService {
  private readonly policy = new AssessmentPolicy();

  constructor(
    @Inject(ASSESSMENT_MATERIAL_REPOSITORY)
    private readonly materialRepo: AssessmentMaterialRepositoryPort,
  ) {}

  async list(auth: AuthContext, options: ListMaterialsOptions) {
    if (!this.policy.canManageMaterials(auth)) {
      throw new MaterialConflictException("无权查看测评材料");
    }

    const result = await this.materialRepo.list(options);
    return {
      items: result.items.map(toMaterialResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async create(auth: AuthContext, schoolId: string, dto: CreateMaterialDto) {
    if (!this.policy.canManageMaterials(auth)) {
      throw new MaterialConflictException("无权创建测评材料");
    }

    const version = await this.materialRepo.nextVersion(schoolId, dto.type);
    const now = new Date();
    const material: AssessmentMaterial = {
      id: randomUUID(),
      schoolId,
      title: dto.title,
      type: dto.type as AssessmentMaterial["type"],
      content: dto.content ?? null,
      version,
      status: "DRAFT",
      previewedAt: null,
      publishedAt: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.materialRepo.save(material);
    return toMaterialResponse(saved);
  }

  async update(
    auth: AuthContext,
    schoolId: string,
    id: string,
    dto: UpdateMaterialDto,
  ) {
    if (!this.policy.canManageMaterials(auth)) {
      throw new MaterialConflictException("无权更新测评材料");
    }

    const existing = await this.materialRepo.findById(schoolId, id);
    if (!existing) {
      throw new MaterialNotFoundException();
    }

    if (existing.status !== "DRAFT") {
      throw new MaterialConflictException(
        "只能修改草稿状态的测评材料",
      );
    }

    const expectedUpdatedAt = new Date(dto.expectedUpdatedAt).getTime();
    if (existing.updatedAt.getTime() !== expectedUpdatedAt) {
      throw new MaterialVersionConflictException(
        "测评材料已被修改，请刷新后重试",
      );
    }

    const updated: AssessmentMaterial = {
      ...existing,
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.content !== undefined ? { content: dto.content } : {}),
      updatedAt: new Date(),
    };

    const saved = await this.materialRepo.save(updated);
    return toMaterialResponse(saved);
  }

  async preview(auth: AuthContext, schoolId: string, id: string) {
    if (!this.policy.canPreview(auth)) {
      throw new MaterialConflictException("无权预览测评材料");
    }

    const existing = await this.materialRepo.findById(schoolId, id);
    if (!existing) {
      throw new MaterialNotFoundException();
    }

    if (existing.status !== "DRAFT") {
      throw new MaterialConflictException("只能预览草稿状态的测评材料");
    }

    const now = new Date();
    const updated: AssessmentMaterial = {
      ...existing,
      previewedAt: now,
      updatedAt: now,
    };

    const saved = await this.materialRepo.save(updated);
    return toMaterialResponse(saved);
  }

  async publish(auth: AuthContext, schoolId: string, id: string) {
    if (!this.policy.canPublish(auth)) {
      throw new MaterialConflictException("无权发布测评材料");
    }

    const existing = await this.materialRepo.findById(schoolId, id);
    if (!existing) {
      throw new MaterialNotFoundException();
    }

    if (existing.status !== "DRAFT") {
      throw new MaterialConflictException("只能发布草稿状态的测评材料");
    }

    const now = new Date();
    const updated: AssessmentMaterial = {
      ...existing,
      status: "PUBLISHED" as AssessmentMaterialStatus,
      publishedAt: now,
      updatedAt: now,
    };

    const saved = await this.materialRepo.save(updated);
    return toMaterialResponse(saved);
  }

  async archive(auth: AuthContext, schoolId: string, id: string) {
    if (!this.policy.canArchive(auth)) {
      throw new MaterialConflictException("无权归档测评材料");
    }

    const existing = await this.materialRepo.findById(schoolId, id);
    if (!existing) {
      throw new MaterialNotFoundException();
    }

    if (existing.status !== "PUBLISHED") {
      throw new MaterialConflictException("只能归档已发布状态的测评材料");
    }

    const now = new Date();
    const updated: AssessmentMaterial = {
      ...existing,
      status: "ARCHIVED" as AssessmentMaterialStatus,
      archivedAt: now,
      updatedAt: now,
    };

    const saved = await this.materialRepo.save(updated);
    return toMaterialResponse(saved);
  }
}
