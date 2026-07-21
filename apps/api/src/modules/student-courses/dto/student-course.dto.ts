import { IsBoolean, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class ListStudentCoursesQueryDto {
  @IsOptional() @IsString() capabilityTheme?: string;
  @IsOptional() @IsString() gradeBand?: string;
  @IsOptional() @IsString() difficulty?: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() status?: string;
}

export class SaveActivityAttemptDto {
  @IsString() @MaxLength(40) kind!: string;
  @IsOptional() @IsObject() value?: Record<string, unknown>;
  @IsOptional() @IsBoolean() completed?: boolean;
  @IsOptional() @IsInt() @Min(0) expectedProgressRevision?: number;
}

export class SaveStudentActivityNoteDto {
  @IsString() @MaxLength(10000) content!: string;
  @IsInt() @Min(0) revision!: number;
}

export class SubmitCourseDto {
  @IsInt() @Min(0) revision!: number;
}
