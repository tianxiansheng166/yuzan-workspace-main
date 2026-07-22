import { IsEnum, IsISO8601, IsOptional, IsUUID, IsObject } from "class-validator";
import { Type } from "class-transformer";
import type { ReportType } from "../domain/report.types.js";

export class CreateReportDto {
  @IsEnum(["STUDENT_GROWTH", "CLASS_SUMMARY", "SCHOOL_OVERVIEW"])
  type!: ReportType;

  @IsISO8601()
  periodStart!: string;

  @IsISO8601()
  periodEnd!: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  enrollmentId?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;
}

export class ListReportsQueryDto {
  @Type(() => Number)
  limit?: number;

  cursor?: string;

  @IsOptional()
  @IsEnum(["STUDENT_GROWTH", "CLASS_SUMMARY", "SCHOOL_OVERVIEW"])
  type?: ReportType;

  @IsOptional()
  @IsEnum(["PENDING", "GENERATING", "READY", "FAILED"])
  status?: "PENDING" | "GENERATING" | "READY" | "FAILED";
}
