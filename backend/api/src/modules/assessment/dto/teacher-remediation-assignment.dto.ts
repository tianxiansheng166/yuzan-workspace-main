import { ArrayMinSize, IsArray, IsIn, IsString, IsUUID, ValidateIf } from "class-validator";

export class TeacherRemediationFocusDto {
  @IsIn(["ALL_RETRY", "FAMILY"])
  mode: "ALL_RETRY" | "FAMILY";

  @ValidateIf((value: TeacherRemediationFocusDto) => value.mode === "FAMILY")
  @IsString()
  family?: string;
}

export class CreateTeacherRemediationAssignmentDto {
  @IsUUID()
  practiceDefinitionId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("4", { each: true })
  enrollmentIds: string[];

  focus: TeacherRemediationFocusDto;
}
