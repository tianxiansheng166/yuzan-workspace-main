import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { SupportedLanguage, TranslationStatus } from "../domain/translation.types.js";

export class CreateTranslationDto {
  @IsEnum(SupportedLanguage)
  readonly sourceLanguage!: SupportedLanguage;

  @IsEnum(SupportedLanguage)
  readonly targetLanguage!: SupportedLanguage;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  readonly sourceText!: string;
}

export class ReviseTranslationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  readonly revisedResult!: string;

  @IsInt()
  @Min(0)
  readonly expectedRevision!: number;
}

export class ApproveTranslationDto {
  @IsInt()
  @Min(0)
  readonly expectedRevision!: number;
}

export class RejectTranslationDto {
  @IsInt()
  @Min(0)
  readonly expectedRevision!: number;
}

/**
 * DTO for internal worker-to-API result updates.
 * Validated by InternalTranslationsController before reaching the service.
 */
export class UpdateJobResultDto {
  @IsString()
  readonly status!: TranslationStatus;

  @IsOptional()
  @IsString()
  readonly machineResult?: string;

  @IsOptional()
  @IsString()
  readonly provider?: string;

  @IsOptional()
  @IsString()
  readonly providerRequestId?: string;

  @IsOptional()
  @IsString()
  readonly providerModel?: string;

  @IsOptional()
  @IsInt()
  readonly providerLatencyMs?: number;

  @IsOptional()
  @IsString()
  readonly errorCode?: string;
}
