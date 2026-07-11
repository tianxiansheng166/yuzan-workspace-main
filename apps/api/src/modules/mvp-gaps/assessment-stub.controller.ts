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

@Controller("api/v1/assessments")
export class AssessmentStubController {
  @Get()
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  @HttpCode(HttpStatus.SERVICE_UNAVAILABLE)
  list() {
    return mvpGapResponse(
      "assessment",
      "PERSISTENCE_PENDING",
      "Assessment persistence is incomplete in this MVP build.",
    );
  }

  @Get(":id")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  @HttpCode(HttpStatus.SERVICE_UNAVAILABLE)
  findById(@Param("id", ParseUUIDPipe) _id: string) {
    return mvpGapResponse(
      "assessment",
      "PERSISTENCE_PENDING",
      "Assessment persistence is incomplete in this MVP build.",
    );
  }

  @Post(":id/responses")
  @RequireRoles(MembershipRole.STUDENT)
  @HttpCode(HttpStatus.SERVICE_UNAVAILABLE)
  submitResponse(@Param("id", ParseUUIDPipe) _id: string) {
    return mvpGapResponse(
      "assessment",
      "PERSISTENCE_PENDING",
      "Assessment response persistence is incomplete in this MVP build.",
    );
  }

  @Get(":id/results")
  @RequireRoles(
    MembershipRole.STUDENT,
    MembershipRole.TEACHER,
    MembershipRole.SCHOOL_ADMIN,
  )
  @HttpCode(HttpStatus.SERVICE_UNAVAILABLE)
  getResults(@Param("id", ParseUUIDPipe) _id: string) {
    return mvpGapResponse(
      "assessment",
      "PERSISTENCE_PENDING",
      "Assessment result persistence is incomplete in this MVP build.",
    );
  }
}
