import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { PRODUCT_PLAN_TIERS, type ProductPlanTier } from "../domain/plan.types.js";

export class CreatePlanDto {
  @IsIn(PRODUCT_PLAN_TIERS)
  tier: ProductPlanTier;

  @IsString()
  displayName: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMinCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMaxCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  discountFactor?: number;

  @IsOptional()
  serviceItems?: unknown[];

  @IsOptional()
  @IsString()
  fundingSource?: string;
}
