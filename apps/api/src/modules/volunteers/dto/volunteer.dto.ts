import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Transform } from "class-transformer";
import { VolunteerStatus, ServiceType } from "../domain/volunteer.types.js";

export class ListVolunteersQueryDto {
  @IsOptional()
  @IsEnum(VolunteerStatus)
  readonly status?: VolunteerStatus;

  @IsOptional()
  @IsString()
  readonly cursor?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? Number.parseInt(value, 10) : value))
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit = 20;
}

export class ApplyVolunteerDto {
  @IsString()
  readonly displayName: string;

  @IsString()
  readonly phone: string;

  @IsOptional()
  @IsString()
  readonly email?: string;

  @IsOptional()
  @IsString()
  readonly experience?: string;
}

export class TransitionVolunteerDto {
  @IsEnum(VolunteerStatus)
  readonly status: VolunteerStatus;

  @IsOptional()
  @IsString()
  readonly suspendedReason?: string;
}

export class ListServiceTasksQueryDto {
  @IsOptional()
  @IsString()
  readonly status?: string;

  @IsOptional()
  @IsString()
  readonly cursor?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? Number.parseInt(value, 10) : value))
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit = 20;
}

export class AssignServiceTaskDto {
  @IsString()
  readonly volunteerId: string;
}

export class CreateIncidentDto {
  @IsString()
  readonly type: string;

  @IsString()
  readonly severity: string;

  @IsString()
  readonly description: string;

  @IsOptional()
  @IsString()
  readonly immediateAction?: string;

  @IsOptional()
  @IsString()
  readonly studentRef?: string;
}

export class ListIncidentsQueryDto {
  @IsOptional()
  @IsString()
  readonly severity?: string;

  @IsOptional()
  @IsString()
  readonly status?: string;

  @IsOptional()
  @IsString()
  readonly cursor?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? Number.parseInt(value, 10) : value))
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit = 20;
}
