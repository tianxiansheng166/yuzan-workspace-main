import type { ProductPlan, ProductPlanVersion } from "../domain/plan.types.js";

export interface ProductPlanResponse {
  readonly id: string;
  readonly tier: string;
  readonly displayName: string;
  readonly description: string | null;
  readonly priceMinCents: number;
  readonly priceMaxCents: number;
  readonly discountFactor: number;
  readonly serviceItems: readonly unknown[] | null;
  readonly fundingSource: string | null;
  readonly publicVersion: number;
  readonly contractVersion: number;
  readonly isActive: boolean;
  readonly effectiveFrom: string | null;
  readonly effectiveUntil: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toProductPlanResponse(plan: ProductPlan): ProductPlanResponse {
  return {
    id: plan.id,
    tier: plan.tier,
    displayName: plan.displayName,
    description: plan.description,
    priceMinCents: plan.priceMinCents,
    priceMaxCents: plan.priceMaxCents,
    discountFactor: plan.discountFactor,
    serviceItems: plan.serviceItems,
    fundingSource: plan.fundingSource,
    publicVersion: plan.publicVersion,
    contractVersion: plan.contractVersion,
    isActive: plan.isActive,
    effectiveFrom: plan.effectiveFrom?.toISOString() ?? null,
    effectiveUntil: plan.effectiveUntil?.toISOString() ?? null,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

export interface ProductPlanVersionResponse {
  readonly id: string;
  readonly planId: string;
  readonly version: number;
  readonly displayName: string;
  readonly priceMinCents: number;
  readonly priceMaxCents: number;
  readonly discountFactor: number;
  readonly serviceItems: readonly unknown[] | null;
  readonly publishedAt: string | null;
  readonly createdAt: string;
}

export function toProductPlanVersionResponse(
  version: ProductPlanVersion,
): ProductPlanVersionResponse {
  return {
    id: version.id,
    planId: version.planId,
    version: version.version,
    displayName: version.displayName,
    priceMinCents: version.priceMinCents,
    priceMaxCents: version.priceMaxCents,
    discountFactor: version.discountFactor,
    serviceItems: version.serviceItems,
    publishedAt: version.publishedAt?.toISOString() ?? null,
    createdAt: version.createdAt.toISOString(),
  };
}
