import { IsString, IsInt, IsOptional, Min } from "class-validator";

export class CreateConsentDto {
  @IsString()
  purpose: string;

  @IsInt()
  @Min(1)
  version: number;

  @IsString()
  contentHash: string;

  @IsOptional()
  @IsString()
  contentUrl?: string;
}
