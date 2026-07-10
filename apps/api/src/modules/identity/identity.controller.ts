import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { Response } from "express";
import { Public, CurrentPrincipal } from "../../common/security/index.js";
import { IdentityService } from "./identity.service.js";
import { LoginDto } from "./dto/login.dto.js";
import { RefreshSessionDto } from "./dto/refresh-session.dto.js";
import { LogoutDto } from "./dto/logout.dto.js";
import type { Principal } from "../../common/security/index.js";

const REFRESH_TOKEN_COOKIE = "refresh_token";
const ACCESS_TOKEN_COOKIE = "access_token";

function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const parts = header.split(" ");
  if (parts.length === 2 && parts[0]?.toLowerCase() === "bearer") {
    return parts[1] ?? null;
  }
  return null;
}

function buildSessionCookies(tokens: {
  accessToken: string;
  refreshToken: string;
}) {
  const common = {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
  };
  return {
    access: [ACCESS_TOKEN_COOKIE, tokens.accessToken, common] as const,
    refresh: [REFRESH_TOKEN_COOKIE, tokens.refreshToken, common] as const,
  };
}

@Controller("/")
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Public()
  @Post("/auth/login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.identityService.login(
      dto.identifier,
      dto.password,
    );
    const cookies = buildSessionCookies(session.tokens);
    response.cookie(...cookies.access);
    response.cookie(...cookies.refresh);

    return {
      data: {
        accessToken: session.tokens.accessToken,
        expiresIn: Math.floor(
          (session.tokens.accessExpiresAt.getTime() - Date.now()) / 1000,
        ),
        user: this.identityService.toCurrentUser(
          session.user,
          session.memberships,
        ),
      },
      meta: { requestId: "identity-login" },
    };
  }

  @Public()
  @Post("/auth/refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() _dto: RefreshSessionDto,
    @Headers("authorization") authorization: string | undefined,
    @Headers("cookie") cookieHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token =
      extractBearerToken(authorization) ??
      extractCookieValue(cookieHeader, REFRESH_TOKEN_COOKIE);

    if (!token) {
      throw new UnauthorizedException();
    }

    const session = await this.identityService.refresh(token);
    const cookies = buildSessionCookies(session.tokens);
    response.cookie(...cookies.access);
    response.cookie(...cookies.refresh);

    return {
      data: {
        accessToken: session.tokens.accessToken,
        expiresIn: Math.floor(
          (session.tokens.accessExpiresAt.getTime() - Date.now()) / 1000,
        ),
        user: this.identityService.toCurrentUser(
          session.user,
          session.memberships,
        ),
      },
      meta: { requestId: "identity-refresh" },
    };
  }

  @Post("/auth/logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body() _dto: LogoutDto,
    @Headers("authorization") authorization: string | undefined,
    @Headers("cookie") cookieHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token =
      extractBearerToken(authorization) ??
      extractCookieValue(cookieHeader, ACCESS_TOKEN_COOKIE);

    if (token) {
      await this.identityService.logout(token);
    }

    response.clearCookie(ACCESS_TOKEN_COOKIE);
    response.clearCookie(REFRESH_TOKEN_COOKIE);

    return;
  }

  @Get("/me")
  @HttpCode(HttpStatus.OK)
  async me(@CurrentPrincipal() principal: Principal) {
    const { user, memberships } = await this.identityService.getCurrentUser(
      principal.userId,
    );

    return {
      data: this.identityService.toCurrentUser(user, memberships),
      meta: { requestId: "identity-me" },
    };
  }
}

function extractCookieValue(
  cookieHeader: string | undefined,
  name: string,
): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;)\\s*${name}=([^;]+)`));
  return match?.[1] ?? null;
}
