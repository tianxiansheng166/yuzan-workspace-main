import { IsUUID } from "class-validator";

export class CreateSubmissionDto {
  @IsUUID()
  readonly assignmentId!: string;

  @IsUUID()
  readonly enrollmentId!: string;
}
