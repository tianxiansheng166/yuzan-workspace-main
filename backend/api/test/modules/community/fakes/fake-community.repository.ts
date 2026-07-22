import type {
  CommunityRepositoryPort,
  CreatePostData,
  UpdatePostData,
  UpdatePostStatusData,
  CreateCommentData,
  CreateReportData,
  UpdateReportStatusData,
  ListPostsOptions,
  ListCommentsOptions,
  ListReportsOptions,
  PaginatedResult,
} from "../../../../src/modules/community/ports/community-repository.port.js";
import type {
  CommunityPost,
  PostComment,
  ContentReport,
} from "../../../../src/modules/community/domain/community.types.js";

/**
 * In-memory fake implementation of CommunityRepositoryPort for testing.
 *
 * All data is stored in simple arrays and maps so that tests can
 * inspect state and set up preconditions without a real database.
 */
export class FakeCommunityRepository implements CommunityRepositoryPort {
  private readonly posts = new Map<string, CommunityPost>();
  private readonly comments = new Map<string, PostComment>();
  private readonly reports = new Map<string, ContentReport>();
  private nextId = 1;

  /* ---------- helpers for test setup ---------- */

  /** Seed a post into the store. */
  addPost(post: CommunityPost): this {
    this.posts.set(post.id, post);
    return this;
  }

  /** Seed a report into the store. */
  addReport(report: ContentReport): this {
    this.reports.set(report.id, report);
    return this;
  }

  /** Seed a comment into the store. */
  addComment(comment: PostComment): this {
    this.comments.set(comment.id, comment);
    return this;
  }

  /** Get a stored post by id (useful for assertions). */
  getPost(id: string): CommunityPost | undefined {
    return this.posts.get(id);
  }

  /** Get a stored report by id. */
  getReport(id: string): ContentReport | undefined {
    return this.reports.get(id);
  }

  /* ---------- CommunityRepositoryPort ---------- */

  async findPostById(
    _schoolId: string,
    postId: string,
  ): Promise<CommunityPost | null> {
    return this.posts.get(postId) ?? null;
  }

  async listPosts(
    schoolId: string,
    options: ListPostsOptions,
  ): Promise<PaginatedResult<CommunityPost>> {
    let items = [...this.posts.values()].filter(
      (p) => p.schoolId === schoolId,
    );

    if (options.status !== undefined) {
      items = items.filter((p) => p.status === options.status);
    }
    if (options.contentType !== undefined) {
      items = items.filter((p) => p.contentType === options.contentType);
    }
    if (options.authorUserId !== undefined) {
      items = items.filter((p) => p.authorUserId === options.authorUserId);
    }

    // Simple cursor-based pagination using offset stored in cursor string
    const cursor = options.cursor !== undefined ? Number(options.cursor) : 0;
    const sliced = items.slice(cursor, cursor + options.limit);
    const nextOffset = cursor + options.limit;
    const hasMore = nextOffset < items.length;

    return {
      items: sliced,
      nextCursor: hasMore ? String(nextOffset) : null,
      hasMore,
    };
  }

  async createPost(data: CreatePostData): Promise<CommunityPost> {
    const now = new Date();
    const id = `post-${this.nextId++}`;
    const post: CommunityPost = {
      id,
      schoolId: data.schoolId,
      authorUserId: data.authorUserId,
      title: data.title,
      contentType: data.contentType,
      content: data.content,
      attachmentObjectKey: data.attachmentObjectKey,
      status: "DRAFT" as CommunityPost["status"],
      visibilityScope: data.visibilityScope,
      createdAt: now,
      updatedAt: now,
      revision: 1,
    };
    this.posts.set(id, post);
    return post;
  }

  async updatePost(
    _schoolId: string,
    postId: string,
    data: UpdatePostData,
  ): Promise<CommunityPost> {
    const existing = this.posts.get(postId);
    if (!existing) {
      throw new Error(`Post ${postId} not found`);
    }
    const updated: CommunityPost = {
      ...existing,
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
      updatedAt: new Date(),
      revision: existing.revision + 1,
    };
    this.posts.set(postId, updated);
    return updated;
  }

  async updatePostStatus(
    _schoolId: string,
    postId: string,
    data: UpdatePostStatusData,
  ): Promise<CommunityPost> {
    const existing = this.posts.get(postId);
    if (!existing) {
      throw new Error(`Post ${postId} not found`);
    }
    const updated: CommunityPost = {
      ...existing,
      status: data.status,
      reviewedBy: data.reviewedBy ?? existing.reviewedBy,
      reviewNote: data.reviewNote ?? existing.reviewNote,
      publishedAt: data.publishedAt ?? existing.publishedAt,
      updatedAt: new Date(),
      revision: existing.revision + 1,
    };
    this.posts.set(postId, updated);
    return updated;
  }

  async listComments(
    _schoolId: string,
    postId: string,
    options: ListCommentsOptions,
  ): Promise<PaginatedResult<PostComment>> {
    let items = [...this.comments.values()].filter(
      (c) => c.postId === postId,
    );

    const cursor = options.cursor !== undefined ? Number(options.cursor) : 0;
    const sliced = items.slice(cursor, cursor + options.limit);
    const nextOffset = cursor + options.limit;
    const hasMore = nextOffset < items.length;

    return {
      items: sliced,
      nextCursor: hasMore ? String(nextOffset) : null,
      hasMore,
    };
  }

  async createComment(data: CreateCommentData): Promise<PostComment> {
    const now = new Date();
    const id = `comment-${this.nextId++}`;
    const comment: PostComment = {
      id,
      postId: data.postId,
      authorUserId: data.authorUserId,
      content: data.content,
      createdAt: now,
      updatedAt: now,
    };
    this.comments.set(id, comment);
    return comment;
  }

  async createReport(data: CreateReportData): Promise<ContentReport> {
    const now = new Date();
    const id = `report-${this.nextId++}`;
    const report: ContentReport = {
      id,
      schoolId: data.schoolId,
      postId: data.postId,
      reporterUserId: data.reporterUserId,
      reason: data.reason,
      description: data.description,
      status: "PENDING" as ContentReport["status"],
      createdAt: now,
    };
    this.reports.set(id, report);
    return report;
  }

  async listReports(
    schoolId: string,
    options: ListReportsOptions,
  ): Promise<PaginatedResult<ContentReport>> {
    let items = [...this.reports.values()].filter(
      (r) => r.schoolId === schoolId,
    );

    if (options.status !== undefined) {
      items = items.filter((r) => r.status === options.status);
    }

    const cursor = options.cursor !== undefined ? Number(options.cursor) : 0;
    const sliced = items.slice(cursor, cursor + options.limit);
    const nextOffset = cursor + options.limit;
    const hasMore = nextOffset < items.length;

    return {
      items: sliced,
      nextCursor: hasMore ? String(nextOffset) : null,
      hasMore,
    };
  }

  async updateReportStatus(
    _schoolId: string,
    reportId: string,
    data: UpdateReportStatusData,
  ): Promise<ContentReport> {
    const existing = this.reports.get(reportId);
    if (!existing) {
      throw new Error(`Report ${reportId} not found`);
    }
    const updated: ContentReport = {
      ...existing,
      status: data.status,
      reviewedBy: data.reviewedBy,
      reviewedAt: data.reviewedAt,
    };
    this.reports.set(reportId, updated);
    return updated;
  }

  async findReportById(
    _schoolId: string,
    reportId: string,
  ): Promise<ContentReport | null> {
    return this.reports.get(reportId) ?? null;
  }
}
