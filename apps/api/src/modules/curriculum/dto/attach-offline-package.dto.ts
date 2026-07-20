import { IsNotEmpty, IsString } from "class-validator";

export class AttachOfflinePackageDto {
  @IsString()
  @IsNotEmpty()
  readonly offlinePackageId!: string;
}
