import { Type } from "class-transformer";
import { IsInt, IsObject, IsOptional, Max, Min } from "class-validator";

export class UpdateProgressDto {
  @IsInt()
  @Min(0)
  @Max(100)
  readonly progressPercent!: number;

  @IsOptional()
  @IsObject()
  @Type(() => Object)
  readonly localState?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  @Type(() => Object)
  readonly serverState?: Record<string, unknown>;
}

export class CompleteActivityDto {
  @IsOptional()
  @IsObject()
  @Type(() => Object)
  readonly answers?: Record<string, unknown>;
}
