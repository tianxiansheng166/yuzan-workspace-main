import { Transform } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { SUBMISSION_STATUSES, type SubmissionStatus } from "../domain/submission.types.js";

export class ListSubmissionsQueryDto {
  @IsOptional()
  @IsString()
  readonly cursor?: string;

  @IsOptional()
  @Transform(({ value }): unknown =>
    typeof value === "string" ? Number.parseInt(value, 10) : value,
  )
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit = 20;

  @IsOptional()
  @IsEnum(SUBMISSION_STATUSES)
  readonly status?: SubmissionStatus;
}
