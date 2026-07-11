import { Type, Transform } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import {
  TRAINING_PROGRAM_STATUSES,
  type TrainingProgramStatus,
} from "../domain/training.types.js";

export class ListProgramsQueryDto {
  @IsOptional()
  @IsIn(TRAINING_PROGRAM_STATUSES)
  readonly status?: TrainingProgramStatus;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? Number.parseInt(value, 10) : value,
  )
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit: number = 20;

  @IsOptional()
  @IsString()
  readonly cursor?: string;
}

export class CreateProgramDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  readonly title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  readonly description?: string;

  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  readonly objectives!: readonly string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  readonly locale!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  readonly dialect?: string;
}

export class UpdateProgramDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  readonly title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  readonly description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  readonly objectives?: readonly string[];
}

export class EnrollVolunteerDto {
  @IsUUID()
  readonly volunteerUserId!: string;
}

export class UpdateProgressDto {
  @IsUUID()
  readonly moduleId!: string;

  @IsBoolean()
  readonly completed!: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  readonly score?: number;
}

export class ScheduleExamDto {
  @IsUUID()
  readonly enrollmentId!: string;

  @IsISO8601({ strict: true })
  readonly scheduledAt!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  readonly passingScore!: number;
}

export class SubmitExamAttemptDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  readonly score!: number;
}
