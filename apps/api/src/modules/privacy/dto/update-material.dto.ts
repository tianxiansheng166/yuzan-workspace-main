import { IsOptional, IsString, IsDateString } from "class-validator";

export class UpdateMaterialDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  content?: unknown;

  @IsDateString()
  expectedUpdatedAt: string;
}
