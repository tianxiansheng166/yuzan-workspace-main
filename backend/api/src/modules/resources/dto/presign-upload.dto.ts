import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";

export class PresignUploadDto {
  @IsString() @IsNotEmpty() fileName!: string;
  @IsEnum(["IMAGE", "AUDIO", "VIDEO", "DOCUMENT", "SUBTITLE", "OTHER"]) kind!: string;
  @IsOptional() @IsString() contentType?: string;
  @IsOptional() @IsInt() @Min(1) @Max(5368709120) byteSize?: number;
}
