import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { REVIEW_DECISION_TYPES, type ReviewDecisionType } from "../domain/governance.types.js";

export class SubmitReviewDto {
  @IsIn(REVIEW_DECISION_TYPES)
  readonly decision!: ReviewDecisionType;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  readonly comment?: string;
}
