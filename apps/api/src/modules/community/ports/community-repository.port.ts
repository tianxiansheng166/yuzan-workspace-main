import type { MembershipRole } from "../../../common/security/index.js";
import type {
  CommunityPost,
  ContentReport,
  PostComment,
  ContentStatus,
  ContentType,
  ReportStatus,
} from "../domain/community.types.js";

export const COMMUNITY_REPOSITORY = Symbol("COMMUNITY_REPOSITORY");

export interface ListPostsOptions {
  readonly status?: ContentStatus;
  readonly contentType?: ContentType;
  readonly authorUserId?: string;
  readonly limit: number;
  readonly cursor?: string;
}

export interface ListCommentsOptions {
  readonly limit: number;
  readonly cursor?: string;
}

export interface ListReportsOptions {
  readonly status?: ReportStatus;
  readonly limit: number;
  readonly cursor?: string;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface CommunityActor {
  readonly userId: string;
  readonly roles: readonly MembershipRole[];
}

export interface CreatePostData {
  readonly schoolId: string;
  readonly authorUserId: string;
  readonly title: string;
  readonly contentType: ContentType;
  readonly content: string;
  readonly attachmentObjectKey?: string;
  readonly visibilityScope: string;
}

export interface UpdatePostData {
  readonly title?: string;
  readonly content?: string;
}

export interface UpdatePostStatusData {
  readonly status: ContentStatus;
  readonly reviewedBy?: string;
  readonly reviewNote?: string;
  readonly publishedAt?: Date;
}

export interface CreateCommentData {
  readonly postId: string;
  readonly authorUserId: string;
  readonly content: string;
}

export interface CreateReportData {
  readonly schoolId: string;
  readonly postId: string;
  readonly reporterUserId: string;
  readonly reason: import("../domain/community.types.js").ReportReason;
  readonly description?: string;
}

export interface UpdateReportStatusData {
  readonly status: ReportStatus;
  readonly reviewedBy: string;
  readonly reviewedAt: Date;
}

export interface CommunityRepositoryPort {
  findPostById(schoolId: string, postId: string): Promise<CommunityPost | null>;
  listPosts(
    schoolId: string,
    options: ListPostsOptions,
  ): Promise<PaginatedResult<CommunityPost>>;
  createPost(data: CreatePostData): Promise<CommunityPost>;
  updatePost(
    schoolId: string,
    postId: string,
    data: UpdatePostData,
  ): Promise<CommunityPost>;
  updatePostStatus(
    schoolId: string,
    postId: string,
    data: UpdatePostStatusData,
  ): Promise<CommunityPost>;

  listComments(
    schoolId: string,
    postId: string,
    options: ListCommentsOptions,
  ): Promise<PaginatedResult<PostComment>>;
  createComment(data: CreateCommentData): Promise<PostComment>;

  createReport(data: CreateReportData): Promise<ContentReport>;
  listReports(
    schoolId: string,
    options: ListReportsOptions,
  ): Promise<PaginatedResult<ContentReport>>;
  updateReportStatus(
    schoolId: string,
    reportId: string,
    data: UpdateReportStatusData,
  ): Promise<ContentReport>;
  findReportById(
    schoolId: string,
    reportId: string,
  ): Promise<ContentReport | null>;
}
