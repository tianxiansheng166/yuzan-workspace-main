import { IsEnum, IsISO8601, IsOptional, IsString, IsUUID } from "class-validator";
import { ConsentStatus, PairingStatus, RiskLevel, TeacherReviewStatus } from "../domain/support-pairing.types.js";

export class CreatePairingDto {
  @IsUUID()
  readonly studentUserId!: string;

  @IsUUID()
  readonly volunteerUserId!: string;

  @IsUUID()
  readonly supervisorTeacherId!: string;

  @IsString()
  readonly goal!: string;
}

export class UpdateConsentDto {
  @IsEnum(ConsentStatus)
  readonly consentStatus!: ConsentStatus;
}

export class UpdatePairingStatusDto {
  @IsEnum(PairingStatus)
  readonly status!: PairingStatus;
}

export class ListPairingsQueryDto {
  @IsOptional()
  @IsEnum(PairingStatus)
  readonly status?: PairingStatus;

  @IsOptional()
  @IsString()
  readonly cursor?: string;

  @IsOptional()
  readonly limit = 20;
}

export class CreateSessionDto {
  @IsISO8601()
  readonly scheduledAt!: string;
}

export class UpdateSessionDto {
  @IsOptional()
  @IsString()
  readonly summary?: string;

  @IsOptional()
  @IsString()
  readonly nextStep?: string;

  @IsOptional()
  @IsEnum(RiskLevel)
  readonly riskLevel?: RiskLevel;
}

export class ReviewSessionDto {
  @IsEnum(TeacherReviewStatus)
  readonly teacherReviewStatus!: TeacherReviewStatus;
}
