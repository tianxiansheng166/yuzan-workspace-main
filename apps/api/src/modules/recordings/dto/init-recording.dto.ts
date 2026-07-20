import { IsUUID, IsOptional, IsInt, Min, Max, IsString } from "class-validator";

export class InitRecordingDto {
  @IsUUID()
  enrollmentId!: string;

  @IsUUID()
  @IsOptional()
  submissionId?: string;

  @IsInt()
  @Min(1)
  @Max(100)
  partCount!: number;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class InitSimpleRecordingDto {
  @IsUUID()
  enrollmentId!: string;

  @IsUUID()
  @IsOptional()
  submissionId?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
