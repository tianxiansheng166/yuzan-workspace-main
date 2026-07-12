import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { MembershipRole } from "../../../common/security/index.js";

export class InviteUserDto {
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
