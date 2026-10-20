import { IsDateString, IsEnum, IsOptional, IsUUID } from "class-validator";

export class CreateReportDto {
  @IsEnum(["STUDENT_GROWTH", "CLASS_SUMMARY", "SCHOOL_OVERVIEW"])
  type!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  filters?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  enrollmentId?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;
}
