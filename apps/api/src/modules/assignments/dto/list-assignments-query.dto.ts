import { Transform } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListAssignmentsQueryDto {
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

  @IsOptional()
  @IsEnum(["DRAFT", "SCHEDULED", "OPEN", "CLOSED", "CANCELLED", "ARCHIVED"])
  readonly status?:
    | "DRAFT"
    | "SCHEDULED"
    | "OPEN"
    | "CLOSED"
    | "CANCELLED"
    | "ARCHIVED";
}
