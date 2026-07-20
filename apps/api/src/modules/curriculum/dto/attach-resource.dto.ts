import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";

export class AttachResourceDto {
  @IsString()
  @IsNotEmpty()
  readonly resourceId!: string;

  @IsString()
  @IsIn(["INSTRUCTION", "DEMO_AUDIO", "TEACHER_NOTE", "STUDENT_REFERENCE", "WORKSHEET", "SUBTITLE"])
  readonly purpose!: string;

  @IsOptional()
  @IsObject()
  readonly meta?: Record<string, unknown>;
}
