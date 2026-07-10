import { Controller, Get, Param, Post, Body } from "@nestjs/common";
import {
  CurrentPrincipal,
  CurrentTenant,
  MembershipRole,
  Permission,
  Public,
  RequirePermissions,
  RequireRoles,
  type Principal,
  type TenantContext,
} from "../../apps/api/src/common/security/index.js";

@Controller("schools/:schoolId")
export class TestSchoolController {
  @Get("profile")
  getProfile(
    @CurrentPrincipal() principal: Principal,
    @CurrentTenant() tenant: TenantContext,
  ): { principal: Principal; tenant: TenantContext } {
    return { principal, tenant };
  }

  @Get("assignments")
  @RequireRoles(MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN)
  listAssignments(): { ok: true } {
    return { ok: true };
  }

  @Post("submissions")
  @RequirePermissions(Permission.ASSIGNMENT_SUBMIT)
  submitAssignment(@Body() _body: unknown): { ok: true } {
    return { ok: true };
  }
}

@Controller("platform")
export class TestPlatformController {
  @Get("schools")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  listSchools(): { ok: true } {
    return { ok: true };
  }
}

@Controller("public")
export class TestPublicController {
  @Get("health")
  @Public()
  health(): { ok: true } {
    return { ok: true };
  }
}

@Controller("resources/:resourceId")
export class TestResourceController {
  @Get()
  getResource(@Param("resourceId") _id: string): { ok: true } {
    return { ok: true };
  }
}
