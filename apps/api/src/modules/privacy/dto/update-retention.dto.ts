import { IsInt, IsOptional, IsString, IsDateString, Min } from "class-validator";

export class UpdateRetentionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  retentionDays?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  expectedUpdatedAt: string;
}
