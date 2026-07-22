import { Transform } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import {
  MembershipRole,
  MembershipStatus,
} from "../../../common/security/index.js";

export class ListMembersQueryDto {
  @IsOptional()
  @IsEnum(MembershipRole)
  readonly role?: MembershipRole;

  @IsOptional()
  @IsEnum(MembershipStatus)
  readonly status?: MembershipStatus;

  @IsOptional()
  @IsString()
  readonly cursor?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? Number.parseInt(value, 10) : value,
  )
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit = 20;
}
