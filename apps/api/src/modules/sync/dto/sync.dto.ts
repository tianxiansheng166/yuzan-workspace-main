import { IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, Min, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class SyncOperationDto {
  @IsString()
  @MinLength(1)
  readonly entityType!: string;

  @IsString()
  @MinLength(1)
  readonly entityId!: string;

  @IsIn(["CREATE", "UPDATE", "DELETE"])
  readonly operation!: "CREATE" | "UPDATE" | "DELETE";

  @IsOptional()
  @IsObject()
  readonly payload?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  readonly checksum?: string;
}

export class CreateSyncBatchDto {
  @IsUUID()
  readonly deviceId!: string;

  @IsString()
  @MinLength(1)
  readonly clientBatchId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncOperationDto)
  readonly operations!: SyncOperationDto[];
}

export class ListSyncBatchesQueryDto {
  @IsOptional()
  @IsUUID()
  readonly deviceId?: string;

  @IsOptional()
  @IsIn(["ACCEPTED", "DUPLICATE", "CONFLICT", "REJECTED", "PERMISSION_CHANGED"])
  readonly status?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit = 50;

  @IsOptional()
  @IsString()
  readonly cursor?: string;
}

export class UpdateSyncBatchDto {
  @IsIn(["ACCEPTED", "DUPLICATE", "CONFLICT", "REJECTED", "PERMISSION_CHANGED"])
  readonly status!: string;

  @IsOptional()
  @IsObject()
  readonly summary?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  readonly errorCode?: string;
}
