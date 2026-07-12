import { randomUUID } from "node:crypto";
import type {
  ProductPlan,
  ProductPlanTier,
  ProductPlanVersion,
} from "../../../src/modules/product-plans/domain/plan.types.js";

export function productPlan(
  overrides: Partial<ProductPlan> = {},
): ProductPlan {
  const now = new Date();
  return {
    id: randomUUID(),
    tier: "INCLUSIVE" as ProductPlanTier,
    displayName: "普惠版",
    description: null,
    priceMinCents: 9900,
    priceMaxCents: 19900,
    discountFactor: 10000,
    serviceItems: null,
    fundingSource: null,
    publicVersion: 0,
    contractVersion: 1,
    isActive: true,
    effectiveFrom: null,
    effectiveUntil: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function productPlanVersion(
  overrides: Partial<ProductPlanVersion> = {},
): ProductPlanVersion {
  const now = new Date();
  return {
    id: randomUUID(),
    planId: randomUUID(),
    version: 1,
    displayName: "普惠版",
    priceMinCents: 9900,
    priceMaxCents: 19900,
    discountFactor: 10000,
    serviceItems: null,
    publishedAt: now,
    createdAt: now,
    ...overrides,
  };
}
