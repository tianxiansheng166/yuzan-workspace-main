import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import type { ProviderType } from "../domain/provider.types.js";

export class CreateProviderDto {
  @IsEnum(["SPEECH", "LLM", "TRANSLATION", "EMBEDDING", "OTHER"] as const)
  readonly type!: ProviderType;

  @IsOptional()
  @IsBoolean()
  readonly enabled?: boolean;

  @IsOptional()
  @IsString()
  readonly endpointAlias?: string;

  @IsOptional()
  @IsString()
  readonly model?: string;

  @IsOptional()
  @IsString()
  readonly secretKey?: string;
}
