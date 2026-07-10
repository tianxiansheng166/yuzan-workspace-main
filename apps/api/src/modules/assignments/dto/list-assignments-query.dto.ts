import { Transform } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";
import {
  ASSIGNMENT_STATUSES,
  type AssignmentStatus,
} from "../domain/assignment.types.js";

export class ListAssignmentsQueryDto {
  @IsOptional()
  @IsUUID()
  readonly classId?: string;

  @IsOptional()
  @IsEnum(ASSIGNMENT_STATUSES)
  readonly status?: AssignmentStatus;

  @IsOptional()
  @IsString()
  readonly cursor?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? Number.parseInt(value, 10) : value,
  )
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit = 20;
}
