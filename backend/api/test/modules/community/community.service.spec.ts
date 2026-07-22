import { describe, it, expect, beforeEach } from "vitest";
import { CommunityService } from "../../../src/modules/community/community.service.js";
import type { CreatePostInput, UpdatePostInput } from "../../../src/modules/community/community.service.js";
import {
  CommunityForbiddenException,
  CommunityInvalidTransitionException,
  CommunityPostNotFoundException,
  CommunityReportNotFoundException,
  CommunityUnavailableException,
} from "../../../src/modules/community/domain/community.errors.js";
import {
  ContentStatus,
  ContentType,
  ReportReason,
  ReportStatus,
} from "../../../src/modules/community/domain/community.types.js";
import { COMMUNITY_REPOSITORY } from "../../../src/modules/community/ports/community-repository.port.js";
import { UnavailableCommunityRepository } from "../../../src/modules/community/ports/unavailable-community.repository.js";
import { FakeCommunityRepository } from "./fakes/fake-community.repository.js";
import {
  studentAuth,
  teacherAuth,
  schoolAdminAuth,
  platformAdminAuth,
  otherSchoolStudentAuth,
  suspendedStudentAuth,
  SCHOOL_ID,
  OTHER_SCHOOL_ID,
} from "./fixtures/users.js";
import {
  draftPost,
  pendingReviewPost,
  publishedPost,
  rejectedPost,
  hiddenPost,
  pendingReport,
  makePost,
  makeReport,
} from "./fixtures/community.js";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Build a CreatePostInput for use in tests. */
function makeCreatePostInput(
  overrides: Partial<CreatePostInput> = {},
): CreatePostInput {
  return {
    title: "My post",
    contentType: ContentType.TEXT,
    content: "Hello world",
    attachmentObjectKey: undefined,
    visibilityScope: "SCHOOL",
    ...overrides,
  };
}

/** Create a CommunityService backed by the FakeCommunityRepository. */
function makeServiceWithFake(): {
  service: CommunityService;
  repo: FakeCommunityRepository;
} {
  const repo = new FakeCommunityRepository();
  // NestJS @Inject(COMMUNITY_REPOSITORY) resolves to the single constructor parameter.
  // We pass the fake directly since there is only one injected parameter.
  const service = new CommunityService(repo as never);
  return { service, repo };
}

/** Create a CommunityService backed by UnavailableCommunityRepository. */
function makeServiceUnavailable(): CommunityService {
  const repo = new UnavailableCommunityRepository();
  return new CommunityService(repo as never);
}

/* ================================================================== */
/*  createPost                                                         */
/* ================================================================== */

describe("CommunityService — createPost", () => {
  let service: CommunityService;
  let repo: FakeCommunityRepository;

  beforeEach(() => {
    const deps = makeServiceWithFake();
    service = deps.service;
    repo = deps.repo;
  });

  it("allows STUDENT to create a post", async () => {
    const result = await service.createPost(
      studentAuth,
      SCHOOL_ID,
      makeCreatePostInput(),
    );
    expect(result.status).toBe(ContentStatus.DRAFT);
    expect(result.authorUserId).toBe("student-1");
  });

  it("allows TEACHER to create a post", async () => {
    const result = await service.createPost(
      teacherAuth,
      SCHOOL_ID,
      makeCreatePostInput(),
    );
    expect(result.status).toBe(ContentStatus.DRAFT);
  });

  it("allows SCHOOL_ADMIN to create a post", async () => {
    const result = await service.createPost(
      schoolAdminAuth,
      SCHOOL_ID,
      makeCreatePostInput(),
    );
    expect(result.status).toBe(ContentStatus.DRAFT);
  });

  it("allows PLATFORM_ADMIN to create a post (bypasses tenant check)", async () => {
    const result = await service.createPost(
      platformAdminAuth,
      SCHOOL_ID,
      makeCreatePostInput(),
    );
    expect(result.status).toBe(ContentStatus.DRAFT);
  });

  it("rejects a user from a different school (cross-tenant denial)", async () => {
    await expect(
      service.createPost(otherSchoolStudentAuth, SCHOOL_ID, makeCreatePostInput()),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("rejects a suspended user", async () => {
    await expect(
      service.createPost(suspendedStudentAuth, SCHOOL_ID, makeCreatePostInput()),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("passes correct data to the repository", async () => {
    const input = makeCreatePostInput({
      title: "Custom title",
      contentType: ContentType.IMAGE,
      content: "Some content",
      attachmentObjectKey: "uploads/img.png",
      visibilityScope: "CLASS",
    });
    const result = await service.createPost(studentAuth, SCHOOL_ID, input);
    expect(result.title).toBe("Custom title");
    expect(result.contentType).toBe(ContentType.IMAGE);
    expect(result.visibilityScope).toBe("CLASS");
  });

  it("creates post in DRAFT status by default", async () => {
    const result = await service.createPost(
      studentAuth,
      SCHOOL_ID,
      makeCreatePostInput(),
    );
    expect(result.status).toBe(ContentStatus.DRAFT);
  });
});

/* ================================================================== */
/*  listPosts                                                          */
/* ================================================================== */

describe("CommunityService — listPosts", () => {
  let service: CommunityService;
  let repo: FakeCommunityRepository;

  beforeEach(() => {
    const deps = makeServiceWithFake();
    service = deps.service;
    repo = deps.repo;
    repo.addPost(draftPost);
    repo.addPost(publishedPost);
  });

  it("returns posts for a member of the school", async () => {
    const result = await service.listPosts(studentAuth, SCHOOL_ID, { limit: 10 });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects a user from a different school", async () => {
    await expect(
      service.listPosts(otherSchoolStudentAuth, SCHOOL_ID, { limit: 10 }),
    ).rejects.toThrow(CommunityForbiddenException);
  });
});

/* ================================================================== */
/*  getPost                                                            */
/* ================================================================== */

describe("CommunityService — getPost", () => {
  let service: CommunityService;
  let repo: FakeCommunityRepository;

  beforeEach(() => {
    const deps = makeServiceWithFake();
    service = deps.service;
    repo = deps.repo;
    repo.addPost(publishedPost);
    repo.addPost(draftPost);
  });

  it("returns a published post for any member", async () => {
    const result = await service.getPost(studentAuth, SCHOOL_ID, publishedPost.id);
    expect(result.id).toBe(publishedPost.id);
  });

  it("returns a draft post for TEACHER", async () => {
    const result = await service.getPost(teacherAuth, SCHOOL_ID, draftPost.id);
    expect(result.id).toBe(draftPost.id);
  });

  it("rejects STUDENT from viewing a DRAFT post", async () => {
    await expect(
      service.getPost(studentAuth, SCHOOL_ID, draftPost.id),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("throws CommunityPostNotFoundException for missing post", async () => {
    await expect(
      service.getPost(studentAuth, SCHOOL_ID, "nonexistent"),
    ).rejects.toThrow(CommunityPostNotFoundException);
  });

  it("rejects cross-tenant access", async () => {
    await expect(
      service.getPost(otherSchoolStudentAuth, SCHOOL_ID, publishedPost.id),
    ).rejects.toThrow(CommunityForbiddenException);
  });
});

/* ================================================================== */
/*  updatePost                                                         */
/* ================================================================== */

describe("CommunityService — updatePost", () => {
  let service: CommunityService;
  let repo: FakeCommunityRepository;

  beforeEach(() => {
    const deps = makeServiceWithFake();
    service = deps.service;
    repo = deps.repo;
    repo.addPost(draftPost);
  });

  it("allows the author to update their own post", async () => {
    const input: UpdatePostInput = { title: "Updated title", content: undefined };
    const result = await service.updatePost(
      studentAuth,
      SCHOOL_ID,
      draftPost.id,
      input,
    );
    expect(result.title).toBe("Updated title");
  });

  it("rejects a different user from updating the post", async () => {
    // teacherAuth has userId "teacher-1", but draftPost.authorUserId is "student-1"
    const input: UpdatePostInput = { title: "Hacked", content: undefined };
    await expect(
      service.updatePost(teacherAuth, SCHOOL_ID, draftPost.id, input),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("rejects cross-tenant update", async () => {
    const input: UpdatePostInput = { title: "Nope", content: undefined };
    await expect(
      service.updatePost(otherSchoolStudentAuth, SCHOOL_ID, draftPost.id, input),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("throws CommunityPostNotFoundException for missing post", async () => {
    const input: UpdatePostInput = { title: "X", content: undefined };
    await expect(
      service.updatePost(studentAuth, SCHOOL_ID, "nonexistent", input),
    ).rejects.toThrow(CommunityPostNotFoundException);
  });
});

/* ================================================================== */
/*  submitForReview                                                     */
/* ================================================================== */

describe("CommunityService — submitForReview", () => {
  let service: CommunityService;
  let repo: FakeCommunityRepository;

  beforeEach(() => {
    const deps = makeServiceWithFake();
    service = deps.service;
    repo = deps.repo;
    repo.addPost(draftPost);
    repo.addPost(pendingReviewPost);
    repo.addPost(publishedPost);
  });

  it("allows the author to submit a DRAFT post for review", async () => {
    const result = await service.submitForReview(
      studentAuth,
      SCHOOL_ID,
      draftPost.id,
    );
    expect(result.status).toBe(ContentStatus.PENDING_REVIEW);
  });

  it("rejects a non-author from submitting for review", async () => {
    await expect(
      service.submitForReview(teacherAuth, SCHOOL_ID, draftPost.id),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("rejects submitting a post that is not in DRAFT status (policy denies non-DRAFT)", async () => {
    // The policy's canSubmitForReview requires DRAFT status, so non-DRAFT posts
    // are rejected at the policy level with CommunityForbiddenException.
    await expect(
      service.submitForReview(studentAuth, SCHOOL_ID, pendingReviewPost.id),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("rejects submitting a PUBLISHED post for review (policy denies non-DRAFT)", async () => {
    // Policy canSubmitForReview requires DRAFT, so PUBLISHED is denied at policy level.
    const ownPublished = makePost({
      id: "post-own-published",
      authorUserId: "student-1",
      status: ContentStatus.PUBLISHED,
    });
    repo.addPost(ownPublished);

    await expect(
      service.submitForReview(studentAuth, SCHOOL_ID, ownPublished.id),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("throws CommunityPostNotFoundException for missing post", async () => {
    await expect(
      service.submitForReview(studentAuth, SCHOOL_ID, "nonexistent"),
    ).rejects.toThrow(CommunityPostNotFoundException);
  });

  it("rejects cross-tenant submit for review", async () => {
    await expect(
      service.submitForReview(otherSchoolStudentAuth, SCHOOL_ID, draftPost.id),
    ).rejects.toThrow(CommunityForbiddenException);
  });
});

/* ================================================================== */
/*  reviewPost                                                         */
/* ================================================================== */

describe("CommunityService — reviewPost", () => {
  let service: CommunityService;
  let repo: FakeCommunityRepository;

  beforeEach(() => {
    const deps = makeServiceWithFake();
    service = deps.service;
    repo = deps.repo;
    repo.addPost(pendingReviewPost);
  });

  it("allows TEACHER to approve a PENDING_REVIEW post", async () => {
    const result = await service.reviewPost(
      teacherAuth,
      SCHOOL_ID,
      pendingReviewPost.id,
      "approve",
    );
    expect(result.status).toBe(ContentStatus.PUBLISHED);
  });

  it("allows SCHOOL_ADMIN to approve a PENDING_REVIEW post", async () => {
    const result = await service.reviewPost(
      schoolAdminAuth,
      SCHOOL_ID,
      pendingReviewPost.id,
      "approve",
    );
    expect(result.status).toBe(ContentStatus.PUBLISHED);
  });

  it("allows TEACHER to reject a PENDING_REVIEW post", async () => {
    const result = await service.reviewPost(
      teacherAuth,
      SCHOOL_ID,
      pendingReviewPost.id,
      "reject",
    );
    expect(result.status).toBe(ContentStatus.REJECTED);
  });

  it("rejects STUDENT from reviewing a post", async () => {
    await expect(
      service.reviewPost(studentAuth, SCHOOL_ID, pendingReviewPost.id, "approve"),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("rejects PLATFORM_ADMIN from reviewing (not TEACHER/SCHOOL_ADMIN role)", async () => {
    await expect(
      service.reviewPost(platformAdminAuth, SCHOOL_ID, pendingReviewPost.id, "approve"),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("rejects reviewing a post not in PENDING_REVIEW status", async () => {
    repo.addPost(draftPost);
    await expect(
      service.reviewPost(teacherAuth, SCHOOL_ID, draftPost.id, "approve"),
    ).rejects.toThrow(CommunityInvalidTransitionException);
  });

  it("throws CommunityPostNotFoundException for missing post", async () => {
    await expect(
      service.reviewPost(teacherAuth, SCHOOL_ID, "nonexistent", "approve"),
    ).rejects.toThrow(CommunityPostNotFoundException);
  });

  it("sets reviewedBy when approving", async () => {
    const result = await service.reviewPost(
      teacherAuth,
      SCHOOL_ID,
      pendingReviewPost.id,
      "approve",
    );
    expect(result.reviewedBy).toBe("teacher-1");
  });

  it("sets publishedAt when approving", async () => {
    const result = await service.reviewPost(
      teacherAuth,
      SCHOOL_ID,
      pendingReviewPost.id,
      "approve",
    );
    expect(result.publishedAt).toBeDefined();
  });

  it("sets reviewNote when provided", async () => {
    const result = await service.reviewPost(
      teacherAuth,
      SCHOOL_ID,
      pendingReviewPost.id,
      "reject",
      "Violates policy",
    );
    expect(result.reviewNote).toBe("Violates policy");
    expect(result.status).toBe(ContentStatus.REJECTED);
  });

  it("rejects cross-tenant review", async () => {
    await expect(
      service.reviewPost(otherSchoolStudentAuth, SCHOOL_ID, pendingReviewPost.id, "approve"),
    ).rejects.toThrow(CommunityForbiddenException);
  });
});

/* ================================================================== */
/*  addComment                                                         */
/* ================================================================== */

describe("CommunityService — addComment", () => {
  let service: CommunityService;
  let repo: FakeCommunityRepository;

  beforeEach(() => {
    const deps = makeServiceWithFake();
    service = deps.service;
    repo = deps.repo;
    repo.addPost(publishedPost);
    repo.addPost(draftPost);
  });

  it("allows commenting on a PUBLISHED post", async () => {
    const result = await service.addComment(
      studentAuth,
      SCHOOL_ID,
      publishedPost.id,
      "Great post!",
    );
    expect(result.content).toBe("Great post!");
    expect(result.postId).toBe(publishedPost.id);
  });

  it("rejects commenting on a DRAFT post", async () => {
    await expect(
      service.addComment(studentAuth, SCHOOL_ID, draftPost.id, "Nope"),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("rejects commenting on a HIDDEN post", async () => {
    repo.addPost(hiddenPost);
    await expect(
      service.addComment(studentAuth, SCHOOL_ID, hiddenPost.id, "Nope"),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("rejects commenting on a REJECTED post", async () => {
    repo.addPost(rejectedPost);
    await expect(
      service.addComment(studentAuth, SCHOOL_ID, rejectedPost.id, "Nope"),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("throws CommunityPostNotFoundException for missing post", async () => {
    await expect(
      service.addComment(studentAuth, SCHOOL_ID, "nonexistent", "Hi"),
    ).rejects.toThrow(CommunityPostNotFoundException);
  });

  it("rejects cross-tenant comment", async () => {
    await expect(
      service.addComment(otherSchoolStudentAuth, SCHOOL_ID, publishedPost.id, "Hi"),
    ).rejects.toThrow(CommunityForbiddenException);
  });
});

/* ================================================================== */
/*  listComments                                                       */
/* ================================================================== */

describe("CommunityService — listComments", () => {
  let service: CommunityService;
  let repo: FakeCommunityRepository;

  beforeEach(() => {
    const deps = makeServiceWithFake();
    service = deps.service;
    repo = deps.repo;
    repo.addPost(publishedPost);
  });

  it("returns comments for a published post", async () => {
    const result = await service.listComments(
      studentAuth,
      SCHOOL_ID,
      publishedPost.id,
      { limit: 10 },
    );
    expect(Array.isArray(result.items)).toBe(true);
  });

  it("throws CommunityPostNotFoundException for missing post", async () => {
    await expect(
      service.listComments(studentAuth, SCHOOL_ID, "nonexistent", { limit: 10 }),
    ).rejects.toThrow(CommunityPostNotFoundException);
  });

  it("rejects cross-tenant access", async () => {
    await expect(
      service.listComments(otherSchoolStudentAuth, SCHOOL_ID, publishedPost.id, { limit: 10 }),
    ).rejects.toThrow(CommunityForbiddenException);
  });
});

/* ================================================================== */
/*  createReport                                                       */
/* ================================================================== */

describe("CommunityService — createReport", () => {
  let service: CommunityService;
  let repo: FakeCommunityRepository;

  beforeEach(() => {
    const deps = makeServiceWithFake();
    service = deps.service;
    repo = deps.repo;
    repo.addPost(publishedPost);
  });

  it("allows any authenticated member of the school to report", async () => {
    const result = await service.createReport(
      studentAuth,
      SCHOOL_ID,
      publishedPost.id,
      ReportReason.INAPPROPRIATE,
    );
    expect(result.reason).toBe(ReportReason.INAPPROPRIATE);
    expect(result.status).toBe(ReportStatus.PENDING);
  });

  it("allows TEACHER to create a report", async () => {
    const result = await service.createReport(
      teacherAuth,
      SCHOOL_ID,
      publishedPost.id,
      ReportReason.OFFENSIVE,
    );
    expect(result.reporterUserId).toBe("teacher-1");
  });

  it("stores the optional description", async () => {
    const result = await service.createReport(
      studentAuth,
      SCHOOL_ID,
      publishedPost.id,
      ReportReason.PRIVACY_VIOLATION,
      "Contains personal info",
    );
    expect(result.description).toBe("Contains personal info");
  });

  it("rejects cross-tenant report", async () => {
    await expect(
      service.createReport(
        otherSchoolStudentAuth,
        SCHOOL_ID,
        publishedPost.id,
        ReportReason.OTHER,
      ),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("throws CommunityPostNotFoundException when reporting a missing post", async () => {
    await expect(
      service.createReport(studentAuth, SCHOOL_ID, "nonexistent", ReportReason.OTHER),
    ).rejects.toThrow(CommunityPostNotFoundException);
  });

  it("rejects a suspended user from reporting", async () => {
    await expect(
      service.createReport(
        suspendedStudentAuth,
        SCHOOL_ID,
        publishedPost.id,
        ReportReason.OTHER,
      ),
    ).rejects.toThrow(CommunityForbiddenException);
  });
});

/* ================================================================== */
/*  listReports                                                        */
/* ================================================================== */

describe("CommunityService — listReports", () => {
  let service: CommunityService;
  let repo: FakeCommunityRepository;

  beforeEach(() => {
    const deps = makeServiceWithFake();
    service = deps.service;
    repo = deps.repo;
    repo.addReport(pendingReport);
  });

  it("allows TEACHER to list reports", async () => {
    const result = await service.listReports(teacherAuth, SCHOOL_ID, { limit: 10 });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
  });

  it("allows SCHOOL_ADMIN to list reports", async () => {
    const result = await service.listReports(schoolAdminAuth, SCHOOL_ID, { limit: 10 });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects STUDENT from listing reports", async () => {
    await expect(
      service.listReports(studentAuth, SCHOOL_ID, { limit: 10 }),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("rejects cross-tenant access", async () => {
    await expect(
      service.listReports(otherSchoolStudentAuth, SCHOOL_ID, { limit: 10 }),
    ).rejects.toThrow(CommunityForbiddenException);
  });
});

/* ================================================================== */
/*  reviewReport                                                       */
/* ================================================================== */

describe("CommunityService — reviewReport", () => {
  let service: CommunityService;
  let repo: FakeCommunityRepository;

  beforeEach(() => {
    const deps = makeServiceWithFake();
    service = deps.service;
    repo = deps.repo;
    repo.addPost(publishedPost);
    repo.addReport(pendingReport);
  });

  it("allows TEACHER to dismiss a report", async () => {
    const result = await service.reviewReport(
      teacherAuth,
      SCHOOL_ID,
      pendingReport.id,
      "dismiss",
    );
    expect(result.status).toBe(ReportStatus.DISMISSED);
  });

  it("allows SCHOOL_ADMIN to dismiss a report", async () => {
    const result = await service.reviewReport(
      schoolAdminAuth,
      SCHOOL_ID,
      pendingReport.id,
      "dismiss",
    );
    expect(result.status).toBe(ReportStatus.DISMISSED);
  });

  it("allows TEACHER to uphold a report", async () => {
    const result = await service.reviewReport(
      teacherAuth,
      SCHOOL_ID,
      pendingReport.id,
      "uphold",
    );
    expect(result.status).toBe(ReportStatus.REVIEWED);
  });

  it("changes post status to HIDDEN when report is upheld", async () => {
    await service.reviewReport(
      teacherAuth,
      SCHOOL_ID,
      pendingReport.id,
      "uphold",
    );
    const post = repo.getPost(publishedPost.id);
    expect(post?.status).toBe(ContentStatus.HIDDEN);
  });

  it("does NOT change post status to HIDDEN when report is dismissed", async () => {
    await service.reviewReport(
      teacherAuth,
      SCHOOL_ID,
      pendingReport.id,
      "dismiss",
    );
    const post = repo.getPost(publishedPost.id);
    expect(post?.status).toBe(ContentStatus.PUBLISHED);
  });

  it("does NOT hide a non-PUBLISHED post when upholding a report", async () => {
    // Report targets a DRAFT post
    const draftReport = makeReport({ id: "report-draft", postId: draftPost.id });
    repo.addPost(draftPost);
    repo.addReport(draftReport);

    await service.reviewReport(
      teacherAuth,
      SCHOOL_ID,
      draftReport.id,
      "uphold",
    );
    const post = repo.getPost(draftPost.id);
    // DRAFT post should remain DRAFT, not changed to HIDDEN
    expect(post?.status).toBe(ContentStatus.DRAFT);
  });

  it("rejects STUDENT from reviewing reports", async () => {
    await expect(
      service.reviewReport(studentAuth, SCHOOL_ID, pendingReport.id, "dismiss"),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("throws CommunityReportNotFoundException for missing report", async () => {
    await expect(
      service.reviewReport(teacherAuth, SCHOOL_ID, "nonexistent", "dismiss"),
    ).rejects.toThrow(CommunityReportNotFoundException);
  });

  it("rejects cross-tenant review of reports", async () => {
    await expect(
      service.reviewReport(otherSchoolStudentAuth, SCHOOL_ID, pendingReport.id, "dismiss"),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("sets reviewedBy on the report", async () => {
    const result = await service.reviewReport(
      teacherAuth,
      SCHOOL_ID,
      pendingReport.id,
      "dismiss",
    );
    expect(result.reviewedBy).toBe("teacher-1");
  });
});

/* ================================================================== */
/*  Content lifecycle integration                                      */
/* ================================================================== */

describe("CommunityService — content lifecycle", () => {
  let service: CommunityService;
  let repo: FakeCommunityRepository;

  beforeEach(() => {
    const deps = makeServiceWithFake();
    service = deps.service;
    repo = deps.repo;
  });

  it("DRAFT -> PENDING_REVIEW -> PUBLISHED full flow", async () => {
    // Create
    const created = await service.createPost(
      studentAuth,
      SCHOOL_ID,
      makeCreatePostInput(),
    );
    expect(created.status).toBe(ContentStatus.DRAFT);

    // Submit for review
    const submitted = await service.submitForReview(
      studentAuth,
      SCHOOL_ID,
      created.id,
    );
    expect(submitted.status).toBe(ContentStatus.PENDING_REVIEW);

    // Approve
    const approved = await service.reviewPost(
      teacherAuth,
      SCHOOL_ID,
      created.id,
      "approve",
    );
    expect(approved.status).toBe(ContentStatus.PUBLISHED);
  });

  it("DRAFT -> PENDING_REVIEW -> REJECTED full flow", async () => {
    const created = await service.createPost(
      studentAuth,
      SCHOOL_ID,
      makeCreatePostInput(),
    );

    await service.submitForReview(studentAuth, SCHOOL_ID, created.id);

    const rejected = await service.reviewPost(
      teacherAuth,
      SCHOOL_ID,
      created.id,
      "reject",
      "Not suitable",
    );
    expect(rejected.status).toBe(ContentStatus.REJECTED);
    expect(rejected.reviewNote).toBe("Not suitable");
  });

  it("PUBLISHED -> HIDDEN via report uphold", async () => {
    repo.addPost(publishedPost);
    const report = await service.createReport(
      studentAuth,
      SCHOOL_ID,
      publishedPost.id,
      ReportReason.OFFENSIVE,
    );

    const result = await service.reviewReport(
      teacherAuth,
      SCHOOL_ID,
      report.id,
      "uphold",
    );
    expect(result.status).toBe(ReportStatus.REVIEWED);

    const post = repo.getPost(publishedPost.id);
    expect(post?.status).toBe(ContentStatus.HIDDEN);
  });

  it("cannot submitForReview from PUBLISHED status (policy denies non-DRAFT)", async () => {
    repo.addPost(publishedPost);
    const ownPublished = makePost({
      id: "post-own-pub",
      authorUserId: "student-1",
      status: ContentStatus.PUBLISHED,
    });
    repo.addPost(ownPublished);

    await expect(
      service.submitForReview(studentAuth, SCHOOL_ID, ownPublished.id),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("cannot submitForReview from REJECTED status (policy denies non-DRAFT)", async () => {
    const ownRejected = makePost({
      id: "post-own-rejected",
      authorUserId: "student-1",
      status: ContentStatus.REJECTED,
    });
    repo.addPost(ownRejected);

    await expect(
      service.submitForReview(studentAuth, SCHOOL_ID, ownRejected.id),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("cannot reviewPost from DRAFT status", async () => {
    repo.addPost(draftPost);
    await expect(
      service.reviewPost(teacherAuth, SCHOOL_ID, draftPost.id, "approve"),
    ).rejects.toThrow(CommunityInvalidTransitionException);
  });

  it("cannot reviewPost from PUBLISHED status", async () => {
    repo.addPost(publishedPost);
    await expect(
      service.reviewPost(teacherAuth, SCHOOL_ID, publishedPost.id, "approve"),
    ).rejects.toThrow(CommunityInvalidTransitionException);
  });
});

/* ================================================================== */
/*  UnavailableCommunityRepository                                     */
/* ================================================================== */

describe("CommunityService — unavailable repository throws", () => {
  const service = makeServiceUnavailable();

  it("createPost throws CommunityUnavailableException", async () => {
    await expect(
      service.createPost(studentAuth, SCHOOL_ID, makeCreatePostInput()),
    ).rejects.toThrow(CommunityUnavailableException);
  });

  it("listPosts throws CommunityUnavailableException", async () => {
    await expect(
      service.listPosts(studentAuth, SCHOOL_ID, { limit: 10 }),
    ).rejects.toThrow(CommunityUnavailableException);
  });

  it("getPost throws CommunityUnavailableException", async () => {
    await expect(
      service.getPost(studentAuth, SCHOOL_ID, "any-id"),
    ).rejects.toThrow(CommunityUnavailableException);
  });

  it("updatePost throws CommunityUnavailableException", async () => {
    const input: UpdatePostInput = { title: "X", content: undefined };
    await expect(
      service.updatePost(studentAuth, SCHOOL_ID, "any-id", input),
    ).rejects.toThrow(CommunityUnavailableException);
  });

  it("submitForReview throws CommunityUnavailableException", async () => {
    await expect(
      service.submitForReview(studentAuth, SCHOOL_ID, "any-id"),
    ).rejects.toThrow(CommunityUnavailableException);
  });

  it("reviewPost throws CommunityUnavailableException", async () => {
    await expect(
      service.reviewPost(teacherAuth, SCHOOL_ID, "any-id", "approve"),
    ).rejects.toThrow(CommunityUnavailableException);
  });

  it("addComment throws CommunityUnavailableException", async () => {
    await expect(
      service.addComment(studentAuth, SCHOOL_ID, "any-id", "hi"),
    ).rejects.toThrow(CommunityUnavailableException);
  });

  it("createReport throws CommunityUnavailableException", async () => {
    await expect(
      service.createReport(studentAuth, SCHOOL_ID, "any-id", ReportReason.OTHER),
    ).rejects.toThrow(CommunityUnavailableException);
  });

  it("listReports throws CommunityUnavailableException", async () => {
    await expect(
      service.listReports(teacherAuth, SCHOOL_ID, { limit: 10 }),
    ).rejects.toThrow(CommunityUnavailableException);
  });

  it("reviewReport throws CommunityUnavailableException", async () => {
    await expect(
      service.reviewReport(teacherAuth, SCHOOL_ID, "any-id", "dismiss"),
    ).rejects.toThrow(CommunityUnavailableException);
  });
});

/* ================================================================== */
/*  Cross-tenant denial across all mutating operations                 */
/* ================================================================== */

describe("CommunityService — cross-tenant denial", () => {
  let service: CommunityService;
  let repo: FakeCommunityRepository;

  beforeEach(() => {
    const deps = makeServiceWithFake();
    service = deps.service;
    repo = deps.repo;
    repo.addPost(draftPost);
    repo.addPost(publishedPost);
    repo.addReport(pendingReport);
  });

  it("createPost denies different school", async () => {
    await expect(
      service.createPost(otherSchoolStudentAuth, SCHOOL_ID, makeCreatePostInput()),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("listPosts denies different school", async () => {
    await expect(
      service.listPosts(otherSchoolStudentAuth, SCHOOL_ID, { limit: 10 }),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("getPost denies different school", async () => {
    await expect(
      service.getPost(otherSchoolStudentAuth, SCHOOL_ID, publishedPost.id),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("updatePost denies different school", async () => {
    const input: UpdatePostInput = { title: "X", content: undefined };
    await expect(
      service.updatePost(otherSchoolStudentAuth, SCHOOL_ID, draftPost.id, input),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("submitForReview denies different school", async () => {
    await expect(
      service.submitForReview(otherSchoolStudentAuth, SCHOOL_ID, draftPost.id),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("reviewPost denies different school", async () => {
    await expect(
      service.reviewPost(otherSchoolStudentAuth, SCHOOL_ID, pendingReviewPost.id, "approve"),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("addComment denies different school", async () => {
    await expect(
      service.addComment(otherSchoolStudentAuth, SCHOOL_ID, publishedPost.id, "hi"),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("createReport denies different school", async () => {
    await expect(
      service.createReport(otherSchoolStudentAuth, SCHOOL_ID, publishedPost.id, ReportReason.OTHER),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("listReports denies different school", async () => {
    await expect(
      service.listReports(otherSchoolStudentAuth, SCHOOL_ID, { limit: 10 }),
    ).rejects.toThrow(CommunityForbiddenException);
  });

  it("reviewReport denies different school", async () => {
    await expect(
      service.reviewReport(otherSchoolStudentAuth, SCHOOL_ID, pendingReport.id, "dismiss"),
    ).rejects.toThrow(CommunityForbiddenException);
  });
});
