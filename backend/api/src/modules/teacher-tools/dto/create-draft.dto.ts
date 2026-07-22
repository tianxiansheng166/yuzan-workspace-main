import { IsEnum, IsOptional, IsString, IsObject } from "class-validator";

export enum DraftToolSourceEnum {
  MINDMATE = "MINDMATE",
  MINDGRAPH = "MINDGRAPH",
  LESSON_PLAN = "LESSON_PLAN",
  WORKSHEET = "WORKSHEET",
}

export class CreateDraftDto {
  @IsEnum(DraftToolSourceEnum)
  toolSource!: DraftToolSourceEnum;

  @IsString()
  title!: string;

  @IsObject()
  content!: Record<string, unknown>;
}
