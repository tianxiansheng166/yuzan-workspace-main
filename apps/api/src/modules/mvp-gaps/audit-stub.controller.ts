import {
  Controller,
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

@Controller("audit")
export class AuditStubController {
  @Get("logs")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.SERVICE_UNAVAILABLE)
  searchLogs() {
    return mvpGapResponse(
      "audit",
      "PERSISTENCE_PENDING",
      "Audit log persistence is pending for MVP.",
    );
  }

  @Get("providers")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.SERVICE_UNAVAILABLE)
  listProviders() {
    return mvpGapResponse(
      "audit",
      "PROVIDER_NOT_CONFIGURED",
      "External provider registry is not configured in this MVP build.",
    );
  }

  @Post("providers")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.SERVICE_UNAVAILABLE)
  createProvider() {
    return mvpGapResponse(
      "audit",
      "PROVIDER_NOT_CONFIGURED",
      "External provider registry is not configured in this MVP build.",
    );
  }

  @Get("providers/:id/health")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN, MembershipRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.SERVICE_UNAVAILABLE)
  checkProviderHealth() {
    return mvpGapResponse(
      "audit",
      "PROVIDER_NOT_CONFIGURED",
      "External provider health checks are not configured in this MVP build.",
    );
  }

  @Patch("providers/:id")
  @RequireRoles(MembershipRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.SERVICE_UNAVAILABLE)
  updateProvider() {
    return mvpGapResponse(
      "audit",
      "PROVIDER_NOT_CONFIGURED",
      "External provider registry is not configured in this MVP build.",
    );
  }
}
