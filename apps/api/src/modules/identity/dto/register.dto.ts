import { IsEnum, IsString, Length } from "class-validator";
import { MembershipRole } from "../../../common/security/index.js";

export class RegisterDto {
  @IsString()
  @Length(1, 254)
  identifier!: string;

  @IsString()
  @Length(6, 128)
  password!: string;

  @IsEnum(MembershipRole)
  role!: MembershipRole;
}
