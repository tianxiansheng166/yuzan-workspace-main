import { Type } from "class-transformer";
import { IsArray, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { BilingualContentDto } from "./bilingual-content.dto.js";

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
  @ValidateNested({ each: true })
  @Type(() => BilingualContentDto)
  readonly objectives?: readonly BilingualContentDto[];

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
