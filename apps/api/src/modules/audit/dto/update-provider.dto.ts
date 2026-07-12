import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
} from "class-validator";
import type { ProviderType } from "../domain/provider.types.js";

export class UpdateProviderDto {
  @IsISO8601({ strict: true })
  expectedUpdatedAt!: string;

  @IsOptional()
  @IsEnum(["SPEECH", "LLM", "TRANSLATION", "EMBEDDING", "OTHER"] as const)
  readonly type?: ProviderType;

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
