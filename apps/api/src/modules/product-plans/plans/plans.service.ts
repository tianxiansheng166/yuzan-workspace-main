import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../../common/security/auth.types.js";
import type {
  ProductPlan,
  ProductPlanVersion,
  ListPlansOptions,
  PaginatedResult,
} from "../domain/plan.types.js";
import { PlanPolicy } from "../domain/plan.policy.js";
import {
  PlanNotFoundException,
  PlanConflictException,
  PlanVersionConflictException,
} from "../domain/plan.errors.js";
import {
  PLAN_REPOSITORY,
  type PlanRepositoryPort,
} from "../ports/plan-repository.port.js";
import {
  PLAN_VERSION_REPOSITORY,
  type PlanVersionRepositoryPort,
} from "../ports/plan-version-repository.port.js";
import type { CreatePlanDto } from "../dto/create-plan.dto.js";
import type { UpdatePlanDto } from "../dto/update-plan.dto.js";

@Injectable()
export class PlansService {
  private readonly policy = new PlanPolicy();

  constructor(
    @Inject(PLAN_REPOSITORY)
    private readonly planRepo: PlanRepositoryPort,
    @Inject(PLAN_VERSION_REPOSITORY)
    private readonly versionRepo: PlanVersionRepositoryPort,
  ) {}

  async list(
    auth: AuthContext,
    options: ListPlansOptions,
  ): Promise<PaginatedResult<ProductPlan>> {
    if (!this.policy.canViewPlans(auth)) {
      throw new PlanConflictException("无权查看产品方案");
    }

    return this.planRepo.list(options);
  }

  async findById(auth: AuthContext, id: string): Promise<ProductPlan> {
    if (!this.policy.canViewPlans(auth)) {
      throw new PlanConflictException("无权查看产品方案");
    }

    const plan = await this.planRepo.findById(id);
    if (!plan) {
      throw new PlanNotFoundException();
    }
    return plan;
  }

  async create(auth: AuthContext, dto: CreatePlanDto): Promise<ProductPlan> {
    if (!this.policy.canManagePlans(auth)) {
      throw new PlanConflictException("无权创建产品方案");
    }

    const now = new Date();
    const contractVersion = 1;

    const plan: ProductPlan = {
      id: crypto.randomUUID(),
      tier: dto.tier,
      displayName: dto.displayName,
      description: dto.description ?? null,
      priceMinCents: dto.priceMinCents ?? 0,
      priceMaxCents: dto.priceMaxCents ?? 0,
      discountFactor: dto.discountFactor ?? 10000,
      serviceItems: dto.serviceItems ?? null,
      fundingSource: dto.fundingSource ?? null,
      publicVersion: 0,
      contractVersion,
      isActive: true,
      effectiveFrom: null,
      effectiveUntil: null,
      createdAt: now,
      updatedAt: now,
    };

    return this.planRepo.save(plan);
  }

  async update(
    auth: AuthContext,
    id: string,
    dto: UpdatePlanDto,
  ): Promise<ProductPlan> {
    if (!this.policy.canManagePlans(auth)) {
      throw new PlanConflictException("无权更新产品方案");
    }

    const existing = await this.planRepo.findById(id);
    if (!existing) {
      throw new PlanNotFoundException();
    }

    const existingUpdatedAt = existing.updatedAt.getTime();
    if (existingUpdatedAt !== dto.expectedUpdatedAt) {
      throw new PlanVersionConflictException();
    }

    const updated: ProductPlan = {
      ...existing,
      displayName: dto.displayName ?? existing.displayName,
      description:
        dto.description !== undefined ? dto.description : existing.description,
      priceMinCents:
        dto.priceMinCents !== undefined
          ? dto.priceMinCents
          : existing.priceMinCents,
      priceMaxCents:
        dto.priceMaxCents !== undefined
          ? dto.priceMaxCents
          : existing.priceMaxCents,
      discountFactor:
        dto.discountFactor !== undefined
          ? dto.discountFactor
          : existing.discountFactor,
      serviceItems:
        dto.serviceItems !== undefined
          ? dto.serviceItems
          : existing.serviceItems,
      fundingSource:
        dto.fundingSource !== undefined
          ? dto.fundingSource
          : existing.fundingSource,
      isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
      effectiveFrom:
        dto.effectiveFrom !== undefined
          ? dto.effectiveFrom
            ? new Date(dto.effectiveFrom)
            : null
          : existing.effectiveFrom,
      effectiveUntil:
        dto.effectiveUntil !== undefined
          ? dto.effectiveUntil
            ? new Date(dto.effectiveUntil)
            : null
          : existing.effectiveUntil,
      updatedAt: new Date(),
    };

    return this.planRepo.save(updated);
  }

  async publishVersion(
    auth: AuthContext,
    planId: string,
  ): Promise<ProductPlanVersion> {
    if (!this.policy.canManagePlans(auth)) {
      throw new PlanConflictException("无权发布产品方案版本");
    }

    const plan = await this.planRepo.findById(planId);
    if (!plan) {
      throw new PlanNotFoundException();
    }

    const nextVersion = plan.publicVersion + 1;
    const now = new Date();

    const version: ProductPlanVersion = {
      id: crypto.randomUUID(),
      planId: plan.id,
      version: nextVersion,
      displayName: plan.displayName,
      priceMinCents: plan.priceMinCents,
      priceMaxCents: plan.priceMaxCents,
      discountFactor: plan.discountFactor,
      serviceItems: plan.serviceItems,
      publishedAt: now,
      createdAt: now,
    };

    const savedVersion = await this.versionRepo.save(version);

    const updatedPlan: ProductPlan = {
      ...plan,
      publicVersion: nextVersion,
      updatedAt: now,
    };
    await this.planRepo.save(updatedPlan);

    return savedVersion;
  }

  async listVersions(
    auth: AuthContext,
    planId: string,
  ): Promise<readonly ProductPlanVersion[]> {
    if (!this.policy.canViewPlans(auth)) {
      throw new PlanConflictException("无权查看产品方案版本");
    }

    const plan = await this.planRepo.findById(planId);
    if (!plan) {
      throw new PlanNotFoundException();
    }

    return this.versionRepo.findByPlanId(planId);
  }
}
