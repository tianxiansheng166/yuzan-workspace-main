import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { LATE_POLICIES, type LatePolicy } from "../domain/assignment.types.js";

class ActivityRefDto {
  @IsString()
  @IsNotEmpty()
  readonly activityId!: string;

  @IsString()
  @IsNotEmpty()
  readonly activityType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  readonly title!: string;
}

class RetryPolicyDto {
  @IsOptional()
  readonly maxAttempts = 1;

  @IsOptional()
  readonly allowRetest = false;
}

export class CreateAssignmentDto {
  @IsUUID()
  readonly classId!: string;

  @IsUUID()
  readonly courseVersionId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  readonly title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  readonly teacherNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  readonly studentNotes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ActivityRefDto)
  readonly activityRefs!: ActivityRefDto[];

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  readonly publishAt?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  readonly dueAt?: Date;

  @IsEnum(LATE_POLICIES)
  readonly latePolicy: LatePolicy = "ACCEPT";

  @IsOptional()
  @ValidateNested()
  @Type(() => RetryPolicyDto)
  readonly retryPolicy: RetryPolicyDto = new RetryPolicyDto();
}
