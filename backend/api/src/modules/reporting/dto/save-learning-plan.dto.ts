import { IsObject, IsDateString, IsOptional, IsInt } from "class-validator";
import { Type } from "class-transformer";

export class SaveLearningPlanDto {
  @IsObject()
  planContent!: Record<string, unknown>;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  expectedRevision?: number;
}
