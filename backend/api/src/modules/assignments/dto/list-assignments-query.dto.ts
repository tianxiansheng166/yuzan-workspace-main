import { Transform } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export class ListAssignmentsQueryDto {
  @IsOptional()
  @IsString()
  readonly cursor?: string;

  @IsOptional()
  @Transform(({ value }): unknown =>
    typeof value === "string" ? Number.parseInt(value, 10) : value,
  )
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit = 20;

  @IsOptional()
  @IsEnum(["DRAFT", "SCHEDULED", "OPEN", "CLOSED", "CANCELLED", "ARCHIVED"])
  readonly status?:
    | "DRAFT"
    | "SCHEDULED"
    | "OPEN"
    | "CLOSED"
    | "CANCELLED"
    | "ARCHIVED";

  @IsOptional()
  @IsUUID()
  readonly classId?: string;

  @IsOptional()
  @Transform(({ value }): unknown => typeof value === "string" ? value.trim() : value)
  @IsString()
  @MaxLength(100)
  readonly search?: string;

  @IsOptional()
  @IsDateString()
  readonly dueAtFrom?: string;

  @IsOptional()
  @IsDateString()
  readonly dueAtTo?: string;
}
