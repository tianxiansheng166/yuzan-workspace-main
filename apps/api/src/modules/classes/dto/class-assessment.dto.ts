import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class ClassAssessmentDto {
  @IsEnum(["READING", "WRITTEN", "MIXED"])
  readonly type!: "READING" | "WRITTEN" | "MIXED";

  @IsArray()
  @IsUUID(undefined, { each: true })
  readonly enrollmentIds!: string[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  readonly questionIds?: string[];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  readonly title?: string;
}
