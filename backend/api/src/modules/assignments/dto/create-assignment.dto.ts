import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { AssignmentTargetDto } from "./assignment-target.dto.js";

export class CreateAssignmentDto {
  @IsString()
  readonly title!: string;

  @IsUUID()
  readonly courseVersionId!: string;

  @IsDateString()
  readonly startsAt!: string;

  @IsDateString()
  readonly dueAt!: string;

  @IsOptional()
  @IsBoolean()
  readonly offlineRequired?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignmentTargetDto)
  readonly targets!: AssignmentTargetDto[];
}
