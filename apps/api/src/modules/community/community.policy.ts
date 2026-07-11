import type { AuthContext } from "../../common/security/auth.types.js";
import {
  hasAnyRole,
  hasRole,
  isActive,
  MembershipRole,
} from "../../common/security/index.js";
import type { CommunityPost } from "./domain/community.types.js";
import { ContentStatus } from "./domain/community.types.js";

export class CommunityPolicy {
  canCreatePost(auth: AuthContext, schoolId: string): boolean {
    return this.isMemberOfSchool(auth, schoolId);
  }

  canEditOwnPost(
    auth: AuthContext,
    schoolId: string,
    post: CommunityPost,
  ): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return post.authorUserId === auth.principal.userId;
  }

  canSubmitForReview(
    auth: AuthContext,
    schoolId: string,
    post: CommunityPost,
  ): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return (
      post.authorUserId === auth.principal.userId &&
      post.status === ContentStatus.DRAFT
    );
  }

  canReviewPost(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return hasAnyRole(auth, [
      MembershipRole.TEACHER,
      MembershipRole.SCHOOL_ADMIN,
    ]);
  }

  canComment(
    auth: AuthContext,
    schoolId: string,
    post: CommunityPost,
  ): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return post.status === ContentStatus.PUBLISHED;
  }

  canReport(auth: AuthContext, schoolId: string): boolean {
    return this.isMemberOfSchool(auth, schoolId);
  }

  canReviewReports(auth: AuthContext, schoolId: string): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    return hasAnyRole(auth, [
      MembershipRole.TEACHER,
      MembershipRole.SCHOOL_ADMIN,
    ]);
  }

  canReadPost(
    auth: AuthContext,
    schoolId: string,
    post: CommunityPost,
  ): boolean {
    if (!this.isMemberOfSchool(auth, schoolId)) {
      return false;
    }
    if (hasAnyRole(auth, [MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN])) {
      return true;
    }
    return post.status === ContentStatus.PUBLISHED;
  }

  private isMemberOfSchool(auth: AuthContext, schoolId: string): boolean {
    if (!isActive(auth)) {
      return false;
    }
    if (hasRole(auth, MembershipRole.PLATFORM_ADMIN)) {
      return true;
    }
    return auth.tenant.schoolId === schoolId;
  }
}
