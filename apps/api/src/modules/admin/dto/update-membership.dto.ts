import { IsEnum, IsISO8601, IsOptional } from "class-validator";
import { MembershipRole } from "../../../common/security/index.js";
import { MembershipStatus } from "../../../common/security/auth.types.js";

export class UpdateMembershipDto {
  @IsISO8601({ strict: true })
  expectedUpdatedAt!: string;

  @IsOptional()
  @IsEnum(MembershipRole)
  readonly role?: MembershipRole;

  @IsOptional()
  @IsEnum(MembershipStatus)
  readonly status?: MembershipStatus;
}
