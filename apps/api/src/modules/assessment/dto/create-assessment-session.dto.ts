import { IsUUID, IsEnum, IsOptional } from "class-validator";
import { Type } from "class-transformer";

export class CreateAssessmentSessionDto {
  @IsUUID()
  enrollmentId!: string;

  @IsUUID()
  classId!: string;

  @IsEnum(["READING", "WRITTEN", "MIXED"])
  type!: "READING" | "WRITTEN" | "MIXED";

  @IsOptional()
  @IsUUID()
  retestOfSessionId?: string;
}
