import { Transform } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { ContentType, ContentStatus, ReportReason } from "../domain/community.types.js";

export class CreatePostDto {
  @IsString()
  readonly title!: string;

  @IsEnum(ContentType)
  readonly contentType!: ContentType;

  @IsString()
  readonly content!: string;

  @IsOptional()
  @IsString()
  readonly attachmentObjectKey?: string;

  @IsString()
  readonly visibilityScope!: string;
}

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  readonly title?: string;

  @IsOptional()
  @IsString()
  readonly content?: string;
}

export class ListPostsQueryDto {
  @IsOptional()
  @IsEnum(ContentStatus)
  readonly status?: ContentStatus;

  @IsOptional()
  @IsEnum(ContentType)
  readonly contentType?: ContentType;

  @IsOptional()
  @IsString()
  readonly authorUserId?: string;

  @IsOptional()
  @IsString()
  readonly cursor?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? Number.parseInt(value, 10) : value,
  )
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit = 20;
}

export class SubmitForReviewDto {}

export class CreateCommentDto {
  @IsString()
  readonly content!: string;
}

export class CreateReportDto {
  @IsString()
  readonly postId!: string;

  @IsEnum(ReportReason)
  readonly reason!: ReportReason;

  @IsOptional()
  @IsString()
  readonly description?: string;
}

export class ReviewPostDto {
  @IsString()
  readonly action!: "approve" | "reject";

  @IsOptional()
  @IsString()
  readonly note?: string;
}

export class ReviewReportDto {
  @IsString()
  readonly action!: "dismiss" | "uphold";
}
