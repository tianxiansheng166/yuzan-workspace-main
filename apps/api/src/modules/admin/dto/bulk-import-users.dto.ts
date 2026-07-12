import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { MembershipRole } from "../../../common/security/index.js";

export class ImportUserEntryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  readonly loginIdentifier!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  readonly displayName!: string;

  @IsOptional()
  @IsString()
  readonly schoolId?: string;

  @IsEnum(MembershipRole)
  readonly role!: MembershipRole;
}

export class BulkImportUsersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportUserEntryDto)
  readonly users!: ImportUserEntryDto[];
}
