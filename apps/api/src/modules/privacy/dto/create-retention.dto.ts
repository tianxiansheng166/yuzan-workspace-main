import { IsString, IsInt, IsOptional, IsDateString, Min } from "class-validator";

export class CreateRetentionDto {
  @IsString()
  resourceType: string;

  @IsInt()
  @Min(1)
  retentionDays: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;
}
