import { IsEnum, IsOptional, IsString } from "class-validator";

export class ListReportsQueryDto {
  @IsOptional()
  @IsEnum(["STUDENT_GROWTH", "CLASS_SUMMARY", "SCHOOL_OVERVIEW"])
  type?: string;

  @IsOptional()
  @IsEnum(["PENDING", "GENERATING", "READY", "FAILED"])
  status?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  limit?: number;
}
