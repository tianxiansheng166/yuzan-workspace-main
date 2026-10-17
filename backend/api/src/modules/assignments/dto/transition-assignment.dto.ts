import { IsInt, Min } from "class-validator";

export class TransitionAssignmentDto {
  @IsInt()
  @Min(1)
  readonly expectedRevision!: number;
}
