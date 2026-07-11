import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from "@nestjs/common";
import {
  MembershipRole,
  RequireRoles,
} from "../../common/security/index.js";
import { mvpGapResponse } from "./mvp-gap.response.js";

@Controller("api/v1/admin")
export class AdminStubController {
  @Get("schools")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.SERVICE_UNAVAILABLE)
  listSchools() {
    return mvpGapResponse(
      "admin",
      "PERSISTENCE_PENDING",
      "Admin school persistence is not yet wired in this MVP build.",
    );
  }

  @Post("schools")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.SERVICE_UNAVAILABLE)
  createSchool() {
    return mvpGapResponse(
      "admin",
      "PERSISTENCE_PENDING",
      "Admin school write persistence is pending for MVP.",
    );
  }

  @Get("schools/:id")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.SERVICE_UNAVAILABLE)
  getSchool() {
    return mvpGapResponse(
      "admin",
      "PERSISTENCE_PENDING",
      "Admin school read persistence is pending for MVP.",
    );
  }

  @Patch("schools/:id")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.SERVICE_UNAVAILABLE)
  updateSchool() {
    return mvpGapResponse(
      "admin",
      "PERSISTENCE_PENDING",
      "Admin school write persistence is pending for MVP.",
    );
  }

  @Delete("schools/:id")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.SERVICE_UNAVAILABLE)
  deleteSchool() {
    return mvpGapResponse(
      "admin",
      "PERSISTENCE_PENDING",
      "Admin school write persistence is pending for MVP.",
    );
  }

  @Get("users")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.SERVICE_UNAVAILABLE)
  listUsers() {
    return mvpGapResponse(
      "admin",
      "PERSISTENCE_PENDING",
      "Admin user persistence is pending for MVP.",
    );
  }

  @Post("users/invitations")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.SERVICE_UNAVAILABLE)
  inviteUser() {
    return mvpGapResponse(
      "admin",
      "PERSISTENCE_PENDING",
      "Admin user write persistence is pending for MVP.",
    );
  }

  @Patch("users/:id/membership")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.SERVICE_UNAVAILABLE)
  updateMembership() {
    return mvpGapResponse(
      "admin",
      "PERSISTENCE_PENDING",
      "Admin user write persistence is pending for MVP.",
    );
  }
}
