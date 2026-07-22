import { IsISO8601 } from "class-validator";

export class SubmitReviewDto {
  @IsISO8601({ strict: true })
  expectedUpdatedAt!: string;
}
