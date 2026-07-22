import { IsOptional, IsString, IsUUID } from "class-validator";

export class ListOfflinePackagesQueryDto {
  @IsOptional()
  @IsUUID()
  courseVersionId?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  limit?: number;
}
