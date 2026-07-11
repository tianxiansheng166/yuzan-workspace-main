import {
  ContentStatus,
  ContentType,
  ReportReason,
  ReportStatus,
} from "../../../../src/modules/community/domain/community.types.js";
import type {
  CommunityPost,
  PostComment,
  ContentReport,
} from "../../../../src/modules/community/domain/community.types.js";
import { SCHOOL_ID } from "./users.js";

/* ------------------------------------------------------------------ */
/*  Posts                                                              */
/* ------------------------------------------------------------------ */

export function makePost(
  overrides: Partial<CommunityPost> = {},
): CommunityPost {
  const now = new Date("2025-01-01T00:00:00Z");
  return {
    id: "post-1",
    schoolId: SCHOOL_ID,
    authorUserId: "student-1",
    title: "Test post",
    contentType: ContentType.TEXT,
    content: "Hello world",
    status: ContentStatus.DRAFT,
    visibilityScope: "SCHOOL",
    createdAt: now,
    updatedAt: now,
    revision: 1,
    ...overrides,
  };
}

export const draftPost = makePost({
  id: "post-draft",
  status: ContentStatus.DRAFT,
});

export const pendingReviewPost = makePost({
  id: "post-pending",
  status: ContentStatus.PENDING_REVIEW,
});

export const publishedPost = makePost({
  id: "post-published",
  status: ContentStatus.PUBLISHED,
  publishedAt: new Date("2025-01-02T00:00:00Z"),
});

export const rejectedPost = makePost({
  id: "post-rejected",
  status: ContentStatus.REJECTED,
  reviewedBy: "teacher-1",
  reviewedAt: new Date("2025-01-02T00:00:00Z"),
  reviewNote: "Not appropriate",
});

export const hiddenPost = makePost({
  id: "post-hidden",
  status: ContentStatus.HIDDEN,
  reviewedBy: "teacher-1",
});

/* ------------------------------------------------------------------ */
/*  Comments                                                           */
/* ------------------------------------------------------------------ */

export function makeComment(
  overrides: Partial<PostComment> = {},
): PostComment {
  const now = new Date("2025-01-01T12:00:00Z");
  return {
    id: "comment-1",
    postId: "post-published",
    authorUserId: "student-1",
    content: "Nice post!",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Reports                                                            */
/* ------------------------------------------------------------------ */

export function makeReport(
  overrides: Partial<ContentReport> = {},
): ContentReport {
  const now = new Date("2025-01-01T12:00:00Z");
  return {
    id: "report-1",
    schoolId: SCHOOL_ID,
    postId: "post-published",
    reporterUserId: "student-1",
    reason: ReportReason.INAPPROPRIATE,
    status: ReportStatus.PENDING,
    createdAt: now,
    ...overrides,
  };
}

export const pendingReport = makeReport({
  id: "report-pending",
  postId: "post-published",
  status: ReportStatus.PENDING,
});

export const reviewedReport = makeReport({
  id: "report-reviewed",
  postId: "post-published",
  status: ReportStatus.REVIEWED,
  reviewedBy: "teacher-1",
  reviewedAt: new Date("2025-01-02T00:00:00Z"),
});

export const dismissedReport = makeReport({
  id: "report-dismissed",
  postId: "post-published",
  status: ReportStatus.DISMISSED,
  reviewedBy: "teacher-1",
  reviewedAt: new Date("2025-01-02T00:00:00Z"),
});
