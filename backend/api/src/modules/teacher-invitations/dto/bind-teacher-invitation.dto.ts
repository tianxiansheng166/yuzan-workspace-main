import { IsString, Length } from "class-validator";

export class BindTeacherInvitationDto {
  @IsString()
  @Length(6, 40)
  readonly code!: string;
}
