import { IsBoolean, IsISO8601, IsUUID } from "class-validator";

export class SaveCourseActivityPracticeDto {
  @IsUUID()
  practiceDefinitionId!: string;

  @IsBoolean()
  required!: boolean;

  @IsISO8601({ strict: true })
  expectedUpdatedAt!: string;
}
