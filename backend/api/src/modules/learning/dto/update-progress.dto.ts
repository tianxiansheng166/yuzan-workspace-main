import { IsBoolean, IsNumber, IsOptional, IsUUID } from "class-validator";

export class UpdateProgressDto {
  @IsUUID()
  readonly enrollmentId!: string;

  @IsNumber()
  readonly position!: number;

  @IsBoolean()
  readonly completed!: boolean;

  @IsOptional()
  @IsNumber()
  readonly expectedRevision?: number;
}
