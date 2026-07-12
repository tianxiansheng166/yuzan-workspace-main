import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateSchoolDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  readonly code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  readonly name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  readonly timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  readonly regionCode?: string;
}
