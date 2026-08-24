import { Transform, Type } from "class-transformer";
import { IsIn, IsOptional, IsString, IsUUID, Length, Matches, Max, Min } from "class-validator";

export const PILOT_FEEDBACK_CATEGORIES = ["CONTENT", "MEDIA", "RECORDING", "SCORING", "USABILITY", "TECHNICAL", "OTHER"] as const;
export const PILOT_FEEDBACK_STATUSES = ["OPEN", "ACKNOWLEDGED", "RESOLVED"] as const;

const trim = ({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value;

export class CreatePilotFeedbackDto {
  @IsIn(PILOT_FEEDBACK_CATEGORIES)
  category!: typeof PILOT_FEEDBACK_CATEGORIES[number];

  @Transform(trim)
  @IsString()
  @Length(5, 1000)
  @Matches(/^[^<>]*$/u, { message: "message must be plain text" })
  message!: string;

  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsUUID()
  assessmentItemId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 500)
  currentPath?: string;
}

export class ListPilotFeedbackDto {
  @IsOptional()
  @IsIn(PILOT_FEEDBACK_STATUSES)
  status?: typeof PILOT_FEEDBACK_STATUSES[number];

  @IsOptional()
  @IsIn(PILOT_FEEDBACK_CATEGORIES)
  category?: typeof PILOT_FEEDBACK_CATEGORIES[number];

  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  limit?: number;
}

export class UpdatePilotFeedbackStatusDto {
  @IsIn(["ACKNOWLEDGED", "RESOLVED"])
  status!: "ACKNOWLEDGED" | "RESOLVED";

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 1000)
  @Matches(/^[^<>]*$/u, { message: "resolutionNote must be plain text" })
  resolutionNote?: string;
}

export class PilotOverviewQueryDto {
  @IsOptional()
  @IsIn(["24h", "7d"])
  window?: "24h" | "7d";
}
