import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsUrl,
} from "class-validator";
import { IntegrationMode } from "../domain/tool.types.js";

export class UpdateIntegrationConfigDto {
  @IsOptional()
  @IsBoolean()
  readonly enabled?: boolean;

  @IsOptional()
  @IsEnum(IntegrationMode)
  readonly mode?: IntegrationMode;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  readonly publicUrl?: string;
}

export class CreateMindGraphJobDto {
  @IsOptional()
  @IsObject()
  readonly inputPayload?: Record<string, unknown>;
}
