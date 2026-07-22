import { IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateCourseDraftDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  readonly title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  readonly description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  readonly gradeBand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  readonly capabilityTheme?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  readonly difficulty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  readonly locale: string = "zh-CN";

  @IsOptional()
  @IsString()
  @MaxLength(20)
  readonly dialect?: string;

  @IsOptional()
  @IsArray()
  readonly objectives?: readonly Record<string, unknown>[];

  @IsOptional()
  @IsString()
  readonly coverAsset?: string;

  @IsOptional()
  @IsArray()
  readonly taskGroups?: readonly string[];

  @IsOptional()
  @IsArray()
  readonly culturalElements?: readonly string[];
}
