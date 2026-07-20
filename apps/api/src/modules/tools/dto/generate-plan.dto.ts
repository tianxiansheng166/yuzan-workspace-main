import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class GeneratePlanDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  readonly goal!: string;

  @IsOptional()
  @IsString()
  readonly courseVersionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  readonly gradeBand?: string;
}
