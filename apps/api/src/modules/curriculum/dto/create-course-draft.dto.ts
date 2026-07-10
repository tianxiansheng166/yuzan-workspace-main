import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateCourseDraftDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  readonly title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  readonly description?: string;

  @IsOptional()
  @IsString()
  readonly gradeBand?: string;

  @IsOptional()
  @IsString()
  readonly locale: string = "zh-CN";
}
