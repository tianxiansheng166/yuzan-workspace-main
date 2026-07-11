import type {
  CommunityPost,
  ContentReport,
  PostComment,
} from "../domain/community.types.js";

export interface CommunityPostResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly authorUserId: string;
  readonly title: string;
  readonly contentType: string;
  readonly content: string;
  readonly attachmentObjectKey: string | undefined;
  readonly status: string;
  readonly publishedAt: string | undefined;
  readonly reviewedBy: string | undefined;
  readonly reviewedAt: string | undefined;
  readonly reviewNote: string | undefined;
  readonly visibilityScope: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly revision: number;
}

export function toCommunityPostResponse(
  post: CommunityPost,
): CommunityPostResponse {
  return {
    id: post.id,
    schoolId: post.schoolId,
    authorUserId: post.authorUserId,
    title: post.title,
    contentType: post.contentType,
    content: post.content,
    attachmentObjectKey: post.attachmentObjectKey,
    status: post.status,
    publishedAt: post.publishedAt?.toISOString(),
    reviewedBy: post.reviewedBy,
    reviewedAt: post.reviewedAt?.toISOString(),
    reviewNote: post.reviewNote,
    visibilityScope: post.visibilityScope,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    revision: post.revision,
  };
}

export interface PostCommentResponse {
  readonly id: string;
  readonly postId: string;
  readonly authorUserId: string;
  readonly content: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toPostCommentResponse(
  comment: PostComment,
): PostCommentResponse {
  return {
    id: comment.id,
    postId: comment.postId,
    authorUserId: comment.authorUserId,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}

export interface ContentReportResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly postId: string;
  readonly reporterUserId: string;
  readonly reason: string;
  readonly description: string | undefined;
  readonly status: string;
  readonly reviewedBy: string | undefined;
  readonly reviewedAt: string | undefined;
  readonly createdAt: string;
}

export function toContentReportResponse(
  report: ContentReport,
): ContentReportResponse {
  return {
    id: report.id,
    schoolId: report.schoolId,
    postId: report.postId,
    reporterUserId: report.reporterUserId,
    reason: report.reason,
    description: report.description,
    status: report.status,
    reviewedBy: report.reviewedBy,
    reviewedAt: report.reviewedAt?.toISOString(),
    createdAt: report.createdAt.toISOString(),
  };
}
