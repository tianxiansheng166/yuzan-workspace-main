import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { Transform } from "class-transformer";
import { LeadStatus } from "../domain/cooperation.types.js";

export class SubmitLeadDto {
  @IsString()
  readonly organizationName!: string;

  @IsString()
  readonly contactName!: string;

  @IsString()
  readonly contactChannel!: string;

  @IsOptional()
  @IsString()
  readonly region?: string;

  @IsOptional()
  @IsString()
  readonly schoolType?: string;

  @IsOptional()
  @IsString()
  readonly interestedPlan?: string;

  @IsOptional()
  @IsString()
  readonly needs?: string;

  @IsBoolean()
  readonly consent!: boolean;
}

export class ListLeadsQueryDto {
  @IsOptional()
  @IsEnum(LeadStatus)
  readonly status?: LeadStatus;

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

export class UpdateLeadStatusDto {
  @IsEnum(LeadStatus)
  readonly status!: LeadStatus;

  @IsOptional()
  @IsString()
  readonly assignedOperatorId?: string;
}

export class SubmitSupportApplicationDto {
  @IsOptional()
  @IsString()
  readonly organizationName?: string;

  @IsString()
  readonly guardianName!: string;

  @IsString()
  readonly guardianContact!: string;

  @IsString()
  readonly needCategory!: string;

  @IsString()
  readonly description!: string;

  @IsBoolean()
  readonly consent!: boolean;
}

export class SubmitVolunteerApplicationDto {
  @IsString()
  readonly applicantName!: string;

  @IsString()
  readonly contactInfo!: string;

  @IsOptional()
  @IsString()
  readonly experience?: string;

  @IsOptional()
  @IsString()
  readonly availability?: string;

  @IsOptional()
  @IsString()
  readonly motivation?: string;

  @IsBoolean()
  readonly consent!: boolean;
}

export class ReviewApplicationDto {
  @IsEnum(["approve", "reject"] as const)
  readonly action!: "approve" | "reject";

  @IsOptional()
  @IsString()
  readonly note?: string;
}
