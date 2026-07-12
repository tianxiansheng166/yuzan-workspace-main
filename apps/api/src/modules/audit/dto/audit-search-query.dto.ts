import { Transform } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class AuditSearchQueryDto {
  @IsOptional()
  @IsString()
  readonly schoolId?: string;

  @IsOptional()
  @IsString()
  readonly actorUserId?: string;

  @IsOptional()
  @IsString()
  readonly resourceType?: string;

  @IsOptional()
  @IsString()
  readonly action?: string;

  @IsOptional()
  @IsDateString()
  readonly from?: string;

  @IsOptional()
  @IsDateString()
  readonly to?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? Number.parseInt(value, 10) : value,
  )
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit: number = 20;

  @IsOptional()
  @IsString()
  readonly cursor?: string;
}
