import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request, Response } from "express";
import type { AuthContext, Principal, TenantContext } from "./auth.types.js";
import {
  AUTH_CONTEXT_SOURCE,
  type AuthContextSource,
} from "./auth-context-source.interface.js";
import { isMembershipRole } from "./membership-role.js";
import { IS_PUBLIC_KEY } from "./public.decorator.js";
import { securityLogger } from "./security-logger.js";
import { SecurityException } from "./security-errors.js";

interface SecurityRequest extends Request {
  authContext?: AuthContext;
  principal?: Principal;
  tenant?: TenantContext;
}

function getRequest(context: ExecutionContext): SecurityRequest {
  return context.switchToHttp().getRequest<SecurityRequest>();
}

function getRequestId(context: ExecutionContext): string {
  const response = context.switchToHttp().getResponse<Response>();
  const header = response.getHeader("x-request-id");
  return typeof header === "string" ? header : "unknown";
}

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH_CONTEXT_SOURCE)
    private readonly source: AuthContextSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = getRequest(context);
    const requestId = getRequestId(context);

    try {
      const authContext = await this.source.resolve(context);

      if (!authContext) {
        this.logDenial(request, requestId, "UNAUTHENTICATED");
        throw new SecurityException("UNAUTHENTICATED");
      }

      if (authContext.principal.membershipStatus !== "ACTIVE") {
        this.logDenial(request, requestId, "UNAUTHENTICATED");
        throw new SecurityException("UNAUTHENTICATED", "成员状态未激活");
      }

      const hasUnknownRole = authContext.principal.roles.some(
        (role) => !isMembershipRole(role),
      );
      if (hasUnknownRole) {
        this.logDenial(request, requestId, "UNKNOWN_ROLE");
        throw new SecurityException("UNKNOWN_ROLE");
      }

      request.authContext = authContext;
      request.principal = authContext.principal;
      request.tenant = authContext.tenant;

      return true;
    } catch (error) {
      if (error instanceof SecurityException) {
        throw error;
      }
      this.logDenial(request, requestId, "UNAUTHENTICATED");
      throw new SecurityException("UNAUTHENTICATED");
    }
  }

  private logDenial(
    request: SecurityRequest,
    requestId: string,
    code: string,
  ): void {
    securityLogger.logDenial({
      requestId,
      code,
      method: request.method,
      path: request.path,
    });
  }
}
