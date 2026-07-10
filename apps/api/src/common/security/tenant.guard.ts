import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { AuthContext, TenantContext } from "./auth.types.js";
import { IS_PUBLIC_KEY } from "./public.decorator.js";
import { securityLogger } from "./security-logger.js";
import { SecurityException } from "./security-errors.js";

interface SecurityRequest extends Request {
  authContext?: AuthContext;
  tenant?: TenantContext;
}

function getRequest(context: ExecutionContext): SecurityRequest {
  return context.switchToHttp().getRequest<SecurityRequest>();
}

function getRequestId(context: ExecutionContext): string {
  const response = context
    .switchToHttp()
    .getResponse<{ getHeader(name: string): unknown }>();
  const header = response.getHeader("x-request-id");
  return typeof header === "string" ? header : "unknown";
}

function extractResourceSchoolId(
  context: ExecutionContext,
): string | undefined {
  const request = getRequest(context);
  const params = request.params as Record<string, string> | undefined;
  const query = request.query as Record<string, string> | undefined;
  const body = request.body as Record<string, unknown> | undefined;

  return (
    params?.schoolId ??
    query?.schoolId ??
    (typeof body?.schoolId === "string" ? body.schoolId : undefined)
  );
}

@Injectable()
export class TenantAuthorizationGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = getRequest(context);
    const requestId = getRequestId(context);
    const tenant = request.tenant;

    if (!tenant?.schoolId) {
      securityLogger.logDenial({
        requestId,
        code: "MISSING_TENANT",
        method: request.method,
        path: request.path,
      });
      throw new SecurityException("MISSING_TENANT");
    }

    const resourceSchoolId = extractResourceSchoolId(context);

    if (!resourceSchoolId) {
      // If the endpoint does not identify a school-scoped resource, we still
      // require a tenant context but allow the request to proceed. Feature
      // modules that manage cross-tenant resources must add explicit policies.
      return true;
    }

    if (resourceSchoolId !== tenant.schoolId) {
      const userId = request.authContext?.principal.userId;
      securityLogger.logDenial({
        requestId,
        code: "FORBIDDEN_TENANT",
        schoolId: tenant.schoolId,
        method: request.method,
        path: request.path,
        ...(userId ? { userId } : {}),
      });
      throw new SecurityException("FORBIDDEN_TENANT");
    }

    return true;
  }
}
