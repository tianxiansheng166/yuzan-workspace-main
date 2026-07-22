import { IsEnum, IsOptional, IsUUID } from "class-validator";

export class AssignmentTargetDto {
  @IsEnum(["CLASS", "STUDENT"])
  readonly targetType!: "CLASS" | "STUDENT";

  @IsOptional()
  @IsUUID()
  readonly classId?: string;

  @IsOptional()
  @IsUUID()
  readonly enrollmentId?: string;
}
