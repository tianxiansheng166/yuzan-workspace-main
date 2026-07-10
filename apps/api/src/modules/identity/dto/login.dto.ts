import { IsString, Length } from "class-validator";

export class LoginDto {
  @IsString()
  @Length(1, 254)
  identifier!: string;

  @IsString()
  @Length(8, 128)
  password!: string;
}
