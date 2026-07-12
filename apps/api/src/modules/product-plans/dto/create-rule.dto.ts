import { IsInt, IsOptional, IsString, IsDateString, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class CreateRuleDto {
  @IsString()
  issueCode: string;

  @IsString()
  dimensionCode: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  severityMin: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  severityMax: number;

  @IsString()
  courseVersionId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  priority: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sessions?: number;

  @IsOptional()
  @IsString()
  reasonTemplate?: string;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
