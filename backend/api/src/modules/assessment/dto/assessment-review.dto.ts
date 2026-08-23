import { IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

export class SubmitAssessmentReviewDto {
  @IsNumber({ allowNaN: false, allowInfinity: false })
  score: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
