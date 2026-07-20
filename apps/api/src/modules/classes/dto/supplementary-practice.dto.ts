import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

export class SupplementaryPracticeDto {
  @IsString()
  readonly title!: string;

  @IsOptional()
  @IsString()
  readonly description?: string;

  @IsOptional()
  @IsUUID()
  readonly courseVersionId?: string;

  @IsOptional()
  @IsDateString()
  readonly dueAt?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  readonly targetEnrollmentIds?: string[];
}
