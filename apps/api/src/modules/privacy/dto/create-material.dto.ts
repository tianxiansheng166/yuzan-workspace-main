import { IsString, IsIn, IsOptional } from "class-validator";

const MATERIAL_TYPES = ["READING", "WRITTEN_FORM", "DIMENSION"] as const;

export class CreateMaterialDto {
  @IsString()
  schoolId: string;

  @IsString()
  title: string;

  @IsIn(MATERIAL_TYPES)
  type: string;

  @IsOptional()
  content?: unknown;
}
