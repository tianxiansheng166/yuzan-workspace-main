import { IsISO8601, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateSchoolDto {
  @IsISO8601({ strict: true })
  expectedUpdatedAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  readonly name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  readonly timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  readonly regionCode?: string;

  @IsOptional()
  readonly isActive?: boolean;
}
