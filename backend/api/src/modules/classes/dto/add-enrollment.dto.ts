import { IsEnum, IsUUID } from "class-validator";
import { MembershipRole } from "../../../common/security/index.js";

export class AddEnrollmentDto {
  @IsUUID()
  readonly userId!: string;

  @IsEnum(MembershipRole)
  readonly role!: MembershipRole;
}
