import { IsDateString, IsOptional, IsString } from "class-validator";

export class UpdateClassDto {
  @IsOptional()
  @IsString()
  readonly name?: string;

  @IsOptional()
  @IsString()
  readonly grade?: string;

  @IsDateString()
  readonly expectedUpdatedAt!: string;
}
