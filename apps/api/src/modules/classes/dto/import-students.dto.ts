import { IsArray, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class ImportStudentItemDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  externalId?: string;
}

export class ImportStudentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportStudentItemDto)
  students!: ImportStudentItemDto[];
}
