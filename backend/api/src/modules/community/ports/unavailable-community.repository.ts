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
  findPostById(
    _schoolId: string,
    _postId: string,
  ): Promise<CommunityPost | null> {
    void _schoolId;
    void _postId;
    return Promise.reject(new CommunityUnavailableException());
  }

  listPosts(
    _schoolId: string,
    _options: ListPostsOptions,
  ): Promise<PaginatedResult<CommunityPost>> {
    void _schoolId;
    void _options;
    return Promise.reject(new CommunityUnavailableException());
  }

  createPost(_data: CreatePostData): Promise<CommunityPost> {
    void _data;
    return Promise.reject(new CommunityUnavailableException());
  }

  updatePost(
    _schoolId: string,
    _postId: string,
    _data: UpdatePostData,
  ): Promise<CommunityPost> {
    void _schoolId;
    void _postId;
    void _data;
    return Promise.reject(new CommunityUnavailableException());
  }

  updatePostStatus(
    _schoolId: string,
    _postId: string,
    _data: UpdatePostStatusData,
  ): Promise<CommunityPost> {
    void _schoolId;
    void _postId;
    void _data;
    return Promise.reject(new CommunityUnavailableException());
  }

  listComments(
    _schoolId: string,
    _postId: string,
    _options: ListCommentsOptions,
  ): Promise<PaginatedResult<PostComment>> {
    void _schoolId;
    void _postId;
    void _options;
    return Promise.reject(new CommunityUnavailableException());
  }

  createComment(_data: CreateCommentData): Promise<PostComment> {
    void _data;
    return Promise.reject(new CommunityUnavailableException());
  }

  createReport(_data: CreateReportData): Promise<ContentReport> {
    void _data;
    return Promise.reject(new CommunityUnavailableException());
  }

  listReports(
    _schoolId: string,
    _options: ListReportsOptions,
  ): Promise<PaginatedResult<ContentReport>> {
    void _schoolId;
    void _options;
    return Promise.reject(new CommunityUnavailableException());
  }

  updateReportStatus(
    _schoolId: string,
    _reportId: string,
    _data: UpdateReportStatusData,
  ): Promise<ContentReport> {
    void _schoolId;
    void _reportId;
    void _data;
    return Promise.reject(new CommunityUnavailableException());
  }

  findReportById(
    _schoolId: string,
    _reportId: string,
  ): Promise<ContentReport | null> {
    void _schoolId;
    void _reportId;
    return Promise.reject(new CommunityUnavailableException());
  }
}
