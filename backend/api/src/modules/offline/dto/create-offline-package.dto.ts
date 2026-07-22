import { IsBoolean, IsOptional, IsUUID } from "class-validator";

export class CreateOfflinePackageDto {
  @IsUUID()
  courseVersionId!: string;

  @IsOptional()
  @IsBoolean()
  downloadRequired?: boolean;
}
