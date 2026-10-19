import { Type } from "class-transformer";
import {
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import type { Unit } from "../domain/course-version.types.js";
import { BilingualContentDto } from "./bilingual-content.dto.js";

export class UpdateCourseDraftDto {
  @IsISO8601({ strict: true })
  expectedUpdatedAt!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  gradeBand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  capabilityTheme?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  difficulty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  locale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  dialect?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BilingualContentDto)
  objectives?: readonly BilingualContentDto[];

  @IsOptional()
  @IsString()
  coverAsset?: string;

  @IsOptional()
  @IsArray()
  taskGroups?: readonly string[];

  @IsOptional()
  @IsArray()
  culturalElements?: readonly string[];

  @IsOptional()
  @IsArray()
  units?: readonly Unit[];
}
