import { IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class CreateTeacherInvitationDto {
  @IsUUID()
  readonly classId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  readonly maxUses?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  readonly expiresInDays?: number;
}
