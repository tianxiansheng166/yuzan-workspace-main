import { IsUUID, IsObject, IsOptional, IsNumber, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class SaveWrittenAnswerDto {
  @IsObject()
  content!: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  wordCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  charCount?: number;
}

export class AttachRecordingDto {
  @IsUUID()
  recordingId!: string;
}

export class DeviceCheckDto {
  @IsObject()
  checkResult!: Record<string, unknown>;

  @IsOptional()
  userAgent?: string;
}
