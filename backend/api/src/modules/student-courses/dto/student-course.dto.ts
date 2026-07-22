import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class ListStudentCoursesQueryDto {
  @IsOptional() @IsString() capabilityTheme?: string;
  @IsOptional() @IsString() gradeBand?: string;
  @IsOptional() @IsString() difficulty?: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() taskGroup?: string;
  @IsOptional() @IsString() culturalElement?: string;
  @IsOptional() @IsIn(["createdAt", "publishedAt", "popularity"]) sortBy?: "createdAt" | "publishedAt" | "popularity";
  @IsOptional() @IsIn(["asc", "desc"]) sortOrder?: "asc" | "desc";
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class SaveActivityAttemptDto {
  @IsString() @MaxLength(40) kind!: string;
  @IsOptional() @IsObject() value?: Record<string, unknown>;
  @IsOptional() @IsBoolean() completed?: boolean;
  @IsOptional() @IsNumber() @Min(0) @Max(1) videoPosition?: number;
  @IsOptional() @IsInt() @Min(0) expectedProgressRevision?: number;
}

export class SaveStudentActivityNoteDto {
  @IsString() @MaxLength(10000) content!: string;
  @IsInt() @Min(0) revision!: number;
}

export class CreateStudentActivityNoteDto {
  @IsString() @MaxLength(10000) content!: string;
  @IsOptional() @IsNumber() @Min(0) videoTimestamp?: number;
}

export class UpdateStudentActivityNoteDto {
  @IsString() @MaxLength(10000) content!: string;
  @IsOptional() @IsNumber() @Min(0) videoTimestamp?: number;
  @IsInt() @Min(1) revision!: number;
}

export class SubmitCourseDto {
  @IsInt() @Min(0) revision!: number;
}
