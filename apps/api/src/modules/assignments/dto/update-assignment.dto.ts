import { Type } from "class-transformer";
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { LATE_POLICIES, type LatePolicy } from "../domain/assignment.types.js";

class RetryPolicyDto {
  @IsOptional()
  readonly maxAttempts?: number;

  @IsOptional()
  readonly allowRetest?: boolean;
}

export class UpdateAssignmentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  readonly title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  readonly teacherNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  readonly studentNotes?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  readonly publishAt?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  readonly dueAt?: Date;

  @IsOptional()
  @IsEnum(LATE_POLICIES)
  readonly latePolicy?: LatePolicy;

  @IsOptional()
  @ValidateNested()
  @Type(() => RetryPolicyDto)
  readonly retryPolicy?: RetryPolicyDto;
}
