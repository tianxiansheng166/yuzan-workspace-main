import { IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";
import type { BilingualContent } from "../domain/course-version.types.js";

export class BilingualContentDto implements BilingualContent {
  @IsString()
  @IsNotEmpty()
  originalText!: string;

  @IsOptional()
  @IsString()
  translation?: string;

  /** Locale of originalText. */
  @IsString()
  @IsNotEmpty()
  locale!: string;

  /** Explicit BCP-47 locale of translation, such as bo-CN. */
  @IsOptional()
  @IsString()
  translationLocale?: string;

  @IsIn(["NONE", "AUTO", "EXPERT", "COMMUNITY"])
  translationSource!: BilingualContent["translationSource"];

  @IsIn(["PENDING", "REVIEWED", "EXPERT_CONFIRMED"])
  reviewStatus!: BilingualContent["reviewStatus"];
}
