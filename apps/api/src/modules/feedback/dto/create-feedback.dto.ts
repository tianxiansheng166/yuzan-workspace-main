import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { FeedbackDecision } from "../domain/feedback.types.js";

export class CreateFeedbackDto {
  @IsEnum(["ACCEPT", "RETURN"] as const)
  readonly decision!: FeedbackDecision;

  @IsString()
  @IsNotEmpty()
  readonly comment!: string;

  @IsOptional()
  @IsNumber()
  readonly score?: number;
}
