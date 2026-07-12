import { IsDateString, IsOptional } from "class-validator";

export class RegenerateLinkDto {
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
