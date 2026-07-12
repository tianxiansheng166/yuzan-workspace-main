export type ProductPlanTier = "INCLUSIVE" | "PROFESSIONAL" | "FLAGSHIP";

export const PRODUCT_PLAN_TIERS: readonly ProductPlanTier[] = [
  "INCLUSIVE",
  "PROFESSIONAL",
  "FLAGSHIP",
];

export interface ProductPlan {
  readonly id: string;
  readonly tier: ProductPlanTier;
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
  readonly effectiveFrom: Date | null;
  readonly effectiveUntil: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProductPlanVersion {
  readonly id: string;
  readonly planId: string;
  readonly version: number;
  readonly displayName: string;
  readonly priceMinCents: number;
  readonly priceMaxCents: number;
  readonly discountFactor: number;
  readonly serviceItems: readonly unknown[] | null;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
}

export interface ListPlansOptions {
  readonly limit: number;
  readonly cursor?: string;
  readonly tier?: ProductPlanTier;
  readonly isActive?: boolean;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}
