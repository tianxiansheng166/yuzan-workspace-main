import { Injectable, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type {
  AuthContext,
  AuthContextSource,
} from "../../common/security/index.js";
import { IdentityService } from "../identity/identity.service.js";

/**
 * Session-aware authentication context source.
 *
 * Resolves the principal from an opaque access token delivered via the
 * Authorization: Bearer header or an HttpOnly cookie. Roles and permissions
 * are built from server-side membership data, never from client headers.
 */
@Injectable()
export class SessionAuthContextSource implements AuthContextSource {
  constructor(private readonly identityService: IdentityService) {}

  async resolve(context: ExecutionContext): Promise<AuthContext | null> {
    const request = context.switchToHttp().getRequest<Request>();
    const accessToken = this.extractAccessToken(request);

    if (!accessToken) {
      return null;
    }

    const requestId = this.extractRequestId(context);
    return this.identityService.resolveSession(requestId, accessToken);
  }

  private extractAccessToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (authHeader) {
      const parts = authHeader.split(" ");
      if (parts.length === 2 && parts[0]?.toLowerCase() === "bearer") {
        return parts[1] ?? null;
      }
    }

    const cookieHeader = request.headers.cookie;
    if (cookieHeader) {
      const match = cookieHeader.match(/(?:^|;)\s*access_token=([^;]+)/);
      return match?.[1] ?? null;
    }

    return null;
  }

  private extractRequestId(context: ExecutionContext): string {
    const response = context
      .switchToHttp()
      .getResponse<{ getHeader(name: string): unknown }>();
    const header = response.getHeader("x-request-id");
    return typeof header === "string" ? header : "unknown";
  }
}
