import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export class UpdateAssignmentDto {
  @IsOptional()
  @IsString()
  readonly title?: string;

  @IsOptional()
  @IsDateString()
  readonly startsAt?: string;

  @IsOptional()
  @IsDateString()
  readonly dueAt?: string;

  @IsOptional()
  @IsBoolean()
  readonly offlineRequired?: boolean;

  @IsInt()
  @IsNotEmpty()
  readonly expectedRevision!: number;
}
