import { IsOptional, IsEnum, IsInt, IsUUID, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class ListSessionsQueryDto {
  @IsOptional()
  @IsUUID()
  enrollmentId?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsEnum(["CREATED", "IN_PROGRESS", "SUBMITTED", "PROCESSING", "COMPLETED", "CANCELLED"])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  cursor?: string;
}
