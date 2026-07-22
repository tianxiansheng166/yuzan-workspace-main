import { Transform } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { TranslationStatus } from "../domain/translation.types.js";

export class ListJobsQueryDto {
  @IsOptional()
  @IsEnum(TranslationStatus)
  readonly status?: TranslationStatus;

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
}
