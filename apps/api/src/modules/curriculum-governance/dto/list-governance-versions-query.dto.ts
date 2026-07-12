import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import {
  COURSE_VERSION_STATUSES,
  type CourseVersionStatus,
} from "../../curriculum/domain/course-version.types.js";

export class ListGovernanceVersionsQueryDto {
  @IsOptional()
  @IsIn(COURSE_VERSION_STATUSES)
  readonly status?: CourseVersionStatus;

  @IsOptional()
  @IsString()
  readonly schoolId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit: number = 20;

  @IsOptional()
  @IsString()
  readonly cursor?: string;
}
