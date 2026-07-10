import { Type } from "class-transformer";
import { IsArray, IsIn, IsObject, IsOptional, IsString } from "class-validator";

const QUESTION_KINDS = [
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "FILL_BLANK",
  "SHORT_ANSWER",
  "ORDERING",
  "MATCHING",
] as const;

export class AnswerValueDto {
  @IsIn(QUESTION_KINDS)
  readonly kind!: (typeof QUESTION_KINDS)[number];

  @IsOptional()
  @IsString()
  readonly optionId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  readonly optionIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  readonly values?: string[];

  @IsOptional()
  @IsString()
  readonly text?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  readonly order?: string[];

  @IsOptional()
  @IsObject()
  readonly matches?: Record<string, string>;
}

export class SaveDraftDto {
  @IsObject()
  @Type(() => Object)
  readonly answers!: Record<string, AnswerValueDto>;
}

export class SubmitAnswersDto {
  @IsObject()
  @Type(() => Object)
  readonly answers!: Record<string, AnswerValueDto>;
}
