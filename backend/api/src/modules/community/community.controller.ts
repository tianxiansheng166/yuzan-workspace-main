import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  createAuthContext,
  CurrentPrincipal,
  CurrentTenant,
  MembershipRole,
  RequireRoles,
  type Principal,
  type TenantContext,
} from "../../common/security/index.js";
import { CommunityService } from "./community.service.js";
import {
  CreatePostDto,
  UpdatePostDto,
  ListPostsQueryDto,
  SubmitForReviewDto,
  CreateCommentDto,
  CreateReportDto,
  ReviewPostDto,
  ReviewReportDto,
} from "./dto/community.dto.js";

@Controller("schools/:schoolId/community")
export class CommunityController {
  constructor(
    @Inject(CommunityService)
    private readonly service: CommunityService,
  ) {}

  @Post("posts")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async createPost(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: CreatePostDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.createPost(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      {
        title: dto.title,
        contentType: dto.contentType,
        content: dto.content,
        attachmentObjectKey: dto.attachmentObjectKey,
        visibilityScope: dto.visibilityScope,
      },
    );
  }

  @Get("posts")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async listPosts(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query() query: ListPostsQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const options: import("./ports/community-repository.port.js").ListPostsOptions =
      {
        limit: query.limit,
        ...(query.cursor ? { cursor: query.cursor } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.contentType ? { contentType: query.contentType } : {}),
        ...(query.authorUserId
          ? { authorUserId: query.authorUserId }
          : {}),
      };

    return this.service.listPosts(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      options,
    );
  }

  @Get("posts/:postId")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async getPost(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("postId", ParseUUIDPipe) postId: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getPost(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      postId,
    );
  }

  @Patch("posts/:postId")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async updatePost(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("postId", ParseUUIDPipe) postId: string,
    @Body() dto: UpdatePostDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updatePost(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      postId,
      {
        title: dto.title,
        content: dto.content,
      },
    );
  }

  @Post("posts/:postId/submit")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async submitForReview(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("postId", ParseUUIDPipe) postId: string,
    @Body() _dto: SubmitForReviewDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.submitForReview(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      postId,
    );
  }

  @Post("posts/:postId/review")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async reviewPost(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("postId", ParseUUIDPipe) postId: string,
    @Body() dto: ReviewPostDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.reviewPost(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      postId,
      dto.action,
      dto.note,
    );
  }

  @Post("posts/:postId/comments")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async addComment(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("postId", ParseUUIDPipe) postId: string,
    @Body() dto: CreateCommentDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.addComment(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      postId,
      dto.content,
    );
  }

  @Get("posts/:postId/comments")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async listComments(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("postId", ParseUUIDPipe) postId: string,
    @Query() query: import("./dto/community.dto.js").ListPostsQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const options: import("./ports/community-repository.port.js").ListCommentsOptions =
      {
        limit: query.limit ?? 20,
        ...(query.cursor ? { cursor: query.cursor } : {}),
      };

    return this.service.listComments(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      postId,
      options,
    );
  }

  @Post("reports")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  async createReport(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Body() dto: CreateReportDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.createReport(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      dto.postId,
      dto.reason,
      dto.description,
    );
  }

  @Get("reports")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async listReports(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Query() query: import("./dto/community.dto.js").ListPostsQueryDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    const options: import("./ports/community-repository.port.js").ListReportsOptions =
      {
        limit: query.limit ?? 20,
        ...(query.cursor ? { cursor: query.cursor } : {}),
      };

    return this.service.listReports(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      options,
    );
  }

  @Patch("reports/:reportId")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  async reviewReport(
    @Param("schoolId", ParseUUIDPipe) schoolId: string,
    @Param("reportId", ParseUUIDPipe) reportId: string,
    @Body() dto: ReviewReportDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.reviewReport(
      createAuthContext("request-id", principal, tenant),
      schoolId,
      reportId,
      dto.action,
    );
  }
}
