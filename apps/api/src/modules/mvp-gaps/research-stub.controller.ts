import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import {
  MembershipRole,
  RequireRoles,
} from "../../common/security/index.js";
import { mvpGapResponse } from "./mvp-gap.response.js";

@Controller("research")
export class ResearchStubController {
  @Get("governance/versions")
  @RequireRoles(
    MembershipRole.TEACHER,
    MembershipRole.RESEARCHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  @HttpCode(HttpStatus.SERVICE_UNAVAILABLE)
  listGovernanceVersions() {
    return mvpGapResponse(
      "research",
      "PERSISTENCE_PENDING",
      "Research governance persistence is pending for MVP.",
    );
  }

  @Get("governance/versions/:id")
  @RequireRoles(
    MembershipRole.TEACHER,
    MembershipRole.RESEARCHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  @HttpCode(HttpStatus.SERVICE_UNAVAILABLE)
  getGovernanceVersion(@Param("id", ParseUUIDPipe) _id: string) {
    return mvpGapResponse(
      "research",
      "PERSISTENCE_PENDING",
      "Research governance persistence is pending for MVP.",
    );
  }

  @Post("governance/versions/:id/reviews")
  @RequireRoles(MembershipRole.RESEARCHER, MembershipRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.SERVICE_UNAVAILABLE)
  submitReview(@Param("id", ParseUUIDPipe) _id: string) {
    return mvpGapResponse(
      "research",
      "PERSISTENCE_PENDING",
      "Research governance persistence is pending for MVP.",
    );
  }

  @Get("governance/versions/:id/reviews")
  @RequireRoles(
    MembershipRole.TEACHER,
    MembershipRole.RESEARCHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  @HttpCode(HttpStatus.SERVICE_UNAVAILABLE)
  listReviews(@Param("id", ParseUUIDPipe) _id: string) {
    return mvpGapResponse(
      "research",
      "PERSISTENCE_PENDING",
      "Research governance persistence is pending for MVP.",
    );
  }
}
