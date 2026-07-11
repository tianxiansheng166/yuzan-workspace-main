import { IsArray, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

class SyncOperationInput {
  @IsString()
  operationId!: string;

  @IsString()
  entityType!: string;

  @IsString()
  entityId!: string;

  @IsString()
  action!: string;
}

export class CreateSyncBatchDto {
  @IsUUID()
  deviceId!: string;

  @IsString()
  @MinLength(16)
  @MaxLength(128)
  clientBatchId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncOperationInput)
  operations!: SyncOperationInput[];
}
