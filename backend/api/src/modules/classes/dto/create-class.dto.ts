import { IsOptional, IsString, IsUUID } from "class-validator";

export class CreateClassDto {
  @IsString()
  readonly name!: string;

  @IsString()
  readonly grade!: string;

  @IsUUID()
  readonly termId!: string;

  @IsOptional()
  @IsUUID()
  readonly campusId?: string;
}
