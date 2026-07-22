import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import type { SubmissionStatus } from "../domain/submission.types.js";

export class ListSubmissionsQueryDto {
  @IsOptional()
  @IsString()
  readonly cursor?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? Number.parseInt(value, 10) : value,
  )
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit = 20;

  @IsOptional()
  @IsString()
  readonly status?: SubmissionStatus;
}
