import { IsIn, IsNotEmpty, IsObject, IsString, MaxLength } from "class-validator";

export class SaveDraftDto {
  @IsString()
  @IsIn(["MINDMATE", "MINDGRAPH", "LESSON_PLAN", "WORKSHEET"])
  readonly toolSource!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  readonly title!: string;

  @IsObject()
  readonly content!: Record<string, unknown>;
}
