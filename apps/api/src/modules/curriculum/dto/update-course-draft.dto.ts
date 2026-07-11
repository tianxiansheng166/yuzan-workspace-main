import {
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import type { BilingualContent, Unit } from "../domain/course-version.types.js";

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
  @MaxLength(20)
  locale?: string;

  @IsOptional()
  @IsArray()
  objectives?: readonly BilingualContent[];

  @IsOptional()
  @IsArray()
  units?: readonly Unit[];
}
