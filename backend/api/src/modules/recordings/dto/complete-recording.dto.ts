import { IsOptional, IsInt, Min, IsString, IsUUID } from "class-validator";

export class CompleteRecordingDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  durationMs?: number;

  @IsOptional()
  @IsString()
  objectKey?: string;

  /** If provided with targetText, triggers SpeechJob after recording completion */
  @IsOptional()
  @IsUUID()
  assessmentItemId?: string;

  /** The text the student was supposed to read */
  @IsOptional()
  @IsString()
  targetText?: string;
}
