import { Transform } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { MindGraphJobStatus } from "../domain/tool.types.js";

export class ListJobsQueryDto {
  @IsOptional()
  @IsEnum(MindGraphJobStatus)
  readonly status?: MindGraphJobStatus;

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
