import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import {
  CommunityForbiddenException,
  CommunityInvalidTransitionException,
  CommunityPostNotFoundException,
  CommunityReportNotFoundException,
} from "./domain/community.errors.js";
import { ContentStatus, ReportStatus } from "./domain/community.types.js";
import type { CommunityPost, ReportReason } from "./domain/community.types.js";
import {
  toCommunityPostResponse,
  toContentReportResponse,
  toPostCommentResponse,
} from "./dto/community.response.js";
import type {
  CommunityRepositoryPort,
  ListPostsOptions,
  ListCommentsOptions,
  ListReportsOptions,
  CreatePostData,
  UpdatePostData,
  UpdatePostStatusData,
  CreateCommentData,
  CreateReportData,
  UpdateReportStatusData,
} from "./ports/community-repository.port.js";
import { COMMUNITY_REPOSITORY } from "./ports/community-repository.port.js";
import { CommunityPolicy } from "./community.policy.js";

export interface CreatePostInput {
  readonly title: string;
  readonly contentType: import("./domain/community.types.js").ContentType;
  readonly content: string;
  readonly attachmentObjectKey: string | undefined;
  readonly visibilityScope: string;
}

export interface UpdatePostInput {
  readonly title: string | undefined;
  readonly content: string | undefined;
}

@Injectable()
export class CommunityService {
  private readonly policy = new CommunityPolicy();

  constructor(
    @Inject(COMMUNITY_REPOSITORY)
    private readonly communityRepo: CommunityRepositoryPort,
  ) {}

  async createPost(
    auth: AuthContext,
    schoolId: string,
    data: CreatePostInput,
  ) {
    if (!this.policy.canCreatePost(auth, schoolId)) {
      throw new CommunityForbiddenException();
    }

    const postData: CreatePostData = {
      schoolId,
      authorUserId: auth.principal.userId,
      title: data.title,
      contentType: data.contentType,
      content: data.content,
      ...(data.attachmentObjectKey !== undefined ? { attachmentObjectKey: data.attachmentObjectKey } : {}),
      visibilityScope: data.visibilityScope,
    };

    const post = await this.communityRepo.createPost(postData);
    return toCommunityPostResponse(post);
  }

  async listPosts(
    auth: AuthContext,
    schoolId: string,
    options: ListPostsOptions,
  ) {
    if (!this.policy.canCreatePost(auth, schoolId)) {
      throw new CommunityForbiddenException();
    }

    const result = await this.communityRepo.listPosts(schoolId, options);
    return {
      items: result.items.map(toCommunityPostResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async getPost(auth: AuthContext, schoolId: string, postId: string) {
    const post = await this.communityRepo.findPostById(schoolId, postId);
    if (!post) {
      throw new CommunityPostNotFoundException();
    }

    if (!this.policy.canReadPost(auth, schoolId, post)) {
      throw new CommunityForbiddenException();
    }

    return toCommunityPostResponse(post);
  }

  async updatePost(
    auth: AuthContext,
    schoolId: string,
    postId: string,
    data: UpdatePostInput,
  ) {
    const post = await this.communityRepo.findPostById(schoolId, postId);
    if (!post) {
      throw new CommunityPostNotFoundException();
    }

    if (!this.policy.canEditOwnPost(auth, schoolId, post)) {
      throw new CommunityForbiddenException();
    }

    const repoData: UpdatePostData = {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
    };

    const updated = await this.communityRepo.updatePost(schoolId, postId, repoData);
    return toCommunityPostResponse(updated);
  }

  async submitForReview(
    auth: AuthContext,
    schoolId: string,
    postId: string,
  ) {
    const post = await this.communityRepo.findPostById(schoolId, postId);
    if (!post) {
      throw new CommunityPostNotFoundException();
    }

    if (!this.policy.canSubmitForReview(auth, schoolId, post)) {
      throw new CommunityForbiddenException();
    }

    if (post.status !== ContentStatus.DRAFT) {
      throw new CommunityInvalidTransitionException();
    }

    const statusData: UpdatePostStatusData = {
      status: ContentStatus.PENDING_REVIEW,
    };

    const updated = await this.communityRepo.updatePostStatus(
      schoolId,
      postId,
      statusData,
    );
    return toCommunityPostResponse(updated);
  }

  async reviewPost(
    auth: AuthContext,
    schoolId: string,
    postId: string,
    action: "approve" | "reject",
    note?: string,
  ) {
    if (!this.policy.canReviewPost(auth, schoolId)) {
      throw new CommunityForbiddenException();
    }

    const post = await this.communityRepo.findPostById(schoolId, postId);
    if (!post) {
      throw new CommunityPostNotFoundException();
    }

    if (post.status !== ContentStatus.PENDING_REVIEW) {
      throw new CommunityInvalidTransitionException();
    }

    const now = new Date();
    const statusData: UpdatePostStatusData = {
      status: action === "approve" ? ContentStatus.PUBLISHED : ContentStatus.REJECTED,
      reviewedBy: auth.principal.userId,
      ...(note !== undefined ? { reviewNote: note } : {}),
      ...(action === "approve" ? { publishedAt: now } : {}),
    };

    const updated = await this.communityRepo.updatePostStatus(
      schoolId,
      postId,
      statusData,
    );
    return toCommunityPostResponse(updated);
  }

  async addComment(
    auth: AuthContext,
    schoolId: string,
    postId: string,
    content: string,
  ) {
    const post = await this.communityRepo.findPostById(schoolId, postId);
    if (!post) {
      throw new CommunityPostNotFoundException();
    }

    if (!this.policy.canComment(auth, schoolId, post)) {
      throw new CommunityForbiddenException();
    }

    const commentData: CreateCommentData = {
      postId,
      authorUserId: auth.principal.userId,
      content,
    };

    const comment = await this.communityRepo.createComment(commentData);
    return toPostCommentResponse(comment);
  }

  async listComments(
    auth: AuthContext,
    schoolId: string,
    postId: string,
    options: ListCommentsOptions,
  ) {
    const post = await this.communityRepo.findPostById(schoolId, postId);
    if (!post) {
      throw new CommunityPostNotFoundException();
    }

    if (!this.policy.canReadPost(auth, schoolId, post)) {
      throw new CommunityForbiddenException();
    }

    const result = await this.communityRepo.listComments(
      schoolId,
      postId,
      options,
    );
    return {
      items: result.items.map(toPostCommentResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async createReport(
    auth: AuthContext,
    schoolId: string,
    postId: string,
    reason: import("./domain/community.types.js").ReportReason,
    description?: string,
  ) {
    if (!this.policy.canReport(auth, schoolId)) {
      throw new CommunityForbiddenException();
    }

    const post = await this.communityRepo.findPostById(schoolId, postId);
    if (!post) {
      throw new CommunityPostNotFoundException();
    }

    const reportData: CreateReportData = {
      schoolId,
      postId,
      reporterUserId: auth.principal.userId,
      reason,
      ...(description !== undefined ? { description } : {}),
    };

    const report = await this.communityRepo.createReport(reportData);
    return toContentReportResponse(report);
  }

  async listReports(
    auth: AuthContext,
    schoolId: string,
    options: ListReportsOptions,
  ) {
    if (!this.policy.canReviewReports(auth, schoolId)) {
      throw new CommunityForbiddenException();
    }

    const result = await this.communityRepo.listReports(schoolId, options);
    return {
      items: result.items.map(toContentReportResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async reviewReport(
    auth: AuthContext,
    schoolId: string,
    reportId: string,
    action: "dismiss" | "uphold",
  ) {
    if (!this.policy.canReviewReports(auth, schoolId)) {
      throw new CommunityForbiddenException();
    }

    const report = await this.communityRepo.findReportById(schoolId, reportId);
    if (!report) {
      throw new CommunityReportNotFoundException();
    }

    const now = new Date();
    const statusData: UpdateReportStatusData = {
      status:
        action === "dismiss" ? ReportStatus.DISMISSED : ReportStatus.REVIEWED,
      reviewedBy: auth.principal.userId,
      reviewedAt: now,
    };

    const updated = await this.communityRepo.updateReportStatus(
      schoolId,
      reportId,
      statusData,
    );

    if (action === "uphold") {
      const post = await this.communityRepo.findPostById(
        schoolId,
        report.postId,
      );
      if (post && post.status === ContentStatus.PUBLISHED) {
        await this.communityRepo.updatePostStatus(schoolId, report.postId, {
          status: ContentStatus.HIDDEN,
          reviewedBy: auth.principal.userId,
        } as UpdatePostStatusData);
      }
    }

    return toContentReportResponse(updated);
  }
}
