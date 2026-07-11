import { Injectable } from "@nestjs/common";
import type {
  CommunityPost,
  ContentReport,
  PostComment,
} from "../domain/community.types.js";
import { CommunityUnavailableException } from "../domain/community.errors.js";
import type {
  CommunityRepositoryPort,
  CreateCommentData,
  CreatePostData,
  CreateReportData,
  ListCommentsOptions,
  ListPostsOptions,
  ListReportsOptions,
  PaginatedResult,
  UpdatePostData,
  UpdatePostStatusData,
  UpdateReportStatusData,
} from "./community-repository.port.js";

@Injectable()
export class UnavailableCommunityRepository implements CommunityRepositoryPort {
  async findPostById(
    _schoolId: string,
    _postId: string,
  ): Promise<CommunityPost | null> {
    throw new CommunityUnavailableException();
  }

  async listPosts(
    _schoolId: string,
    _options: ListPostsOptions,
  ): Promise<PaginatedResult<CommunityPost>> {
    throw new CommunityUnavailableException();
  }

  async createPost(_data: CreatePostData): Promise<CommunityPost> {
    throw new CommunityUnavailableException();
  }

  async updatePost(
    _schoolId: string,
    _postId: string,
    _data: UpdatePostData,
  ): Promise<CommunityPost> {
    throw new CommunityUnavailableException();
  }

  async updatePostStatus(
    _schoolId: string,
    _postId: string,
    _data: UpdatePostStatusData,
  ): Promise<CommunityPost> {
    throw new CommunityUnavailableException();
  }

  async listComments(
    _schoolId: string,
    _postId: string,
    _options: ListCommentsOptions,
  ): Promise<PaginatedResult<PostComment>> {
    throw new CommunityUnavailableException();
  }

  async createComment(_data: CreateCommentData): Promise<PostComment> {
    throw new CommunityUnavailableException();
  }

  async createReport(_data: CreateReportData): Promise<ContentReport> {
    throw new CommunityUnavailableException();
  }

  async listReports(
    _schoolId: string,
    _options: ListReportsOptions,
  ): Promise<PaginatedResult<ContentReport>> {
    throw new CommunityUnavailableException();
  }

  async updateReportStatus(
    _schoolId: string,
    _reportId: string,
    _data: UpdateReportStatusData,
  ): Promise<ContentReport> {
    throw new CommunityUnavailableException();
  }

  async findReportById(
    _schoolId: string,
    _reportId: string,
  ): Promise<ContentReport | null> {
    throw new CommunityUnavailableException();
  }
}
