import { IsEnum, IsOptional, IsString, IsUrl } from "class-validator";
import { IntegrationKey } from "../domain/tool.types.js";

export class ClickAuditDto {
  @IsEnum(IntegrationKey)
  readonly integrationKey!: IntegrationKey;

  @IsString()
  readonly action!: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  readonly targetUrl?: string;
}
