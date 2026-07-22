import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class ConfirmUploadDto {
  @IsString() @IsNotEmpty() objectKey!: string;
  @IsOptional() @IsString() checksumSha256?: string;
}
