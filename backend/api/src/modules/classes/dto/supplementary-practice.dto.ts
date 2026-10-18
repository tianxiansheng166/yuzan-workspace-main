import {
  IsArray,
  IsDateString,
  ArrayMinSize,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

export class SupplementaryPracticeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
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
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  readonly targetEnrollmentIds?: string[];
}
