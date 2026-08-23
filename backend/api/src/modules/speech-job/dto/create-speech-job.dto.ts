import { IsUUID, IsOptional, IsString } from "class-validator";

export class CreateSpeechJobDto {
  @IsUUID()
  recordingId: string;

  @IsOptional()
  @IsUUID()
  assessmentItemId?: string;

  @IsOptional()
  @IsString()
  targetText?: string;

  @IsOptional()
  @IsString()
  scorerVersion?: string;

  @IsOptional()
  @IsString()
  provider?: string;
}
