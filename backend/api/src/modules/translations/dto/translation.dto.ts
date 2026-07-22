import { IsEnum, IsNotEmpty, IsString, MaxLength } from "class-validator";
import { SupportedLanguage } from "../domain/translation.types.js";

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
