import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Optional,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { AuthContext } from "./auth.types.js";
import { hasAnyPermission, hasAnyRole } from "./auth-context.js";
import { MembershipRole } from "./membership-role.js";
import { Permission } from "./permission.js";
import { IS_PUBLIC_KEY } from "./public.decorator.js";
import { REQUIRED_PERMISSIONS_KEY } from "./require-permissions.decorator.js";
import { REQUIRED_ROLES_KEY } from "./require-roles.decorator.js";
import {
  RESOURCE_POLICY_KEY,
  type ResourcePolicy,
} from "./resource-policy.interface.js";
import { securityLogger } from "./security-logger.js";
import { SecurityException } from "./security-errors.js";

interface SecurityRequest extends Request {
  authContext?: AuthContext;
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

@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Optional()
    @Inject(RESOURCE_POLICY_KEY)
    private readonly defaultPolicy?: ResourcePolicy<unknown>,
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
    const authContext = request.authContext;

    if (!authContext) {
      securityLogger.logDenial({
        requestId,
        code: "UNAUTHENTICATED",
        method: request.method,
        path: request.path,
      });
      throw new SecurityException("UNAUTHENTICATED");
    }

    const requiredRoles = this.reflector.getAllAndOverride<
      readonly MembershipRole[]
    >(REQUIRED_ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (requiredRoles && requiredRoles.length > 0) {
      if (!hasAnyRole(authContext, requiredRoles)) {
        this.logDenial(request, authContext, requestId, "FORBIDDEN_ROLE");
        throw new SecurityException("FORBIDDEN_ROLE");
      }
    }

    const requiredPermissions = this.reflector.getAllAndOverride<
      readonly Permission[]
    >(REQUIRED_PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (requiredPermissions && requiredPermissions.length > 0) {
      if (!hasAnyPermission(authContext, requiredPermissions)) {
        this.logDenial(request, authContext, requestId, "FORBIDDEN_PERMISSION");
        throw new SecurityException("FORBIDDEN_PERMISSION");
      }
    }

    const policy = this.reflector.getAllAndOverride<ResourcePolicy<unknown>>(
      RESOURCE_POLICY_KEY,
      [context.getHandler(), context.getClass()],
    );

    const policyToRun = policy ?? this.defaultPolicy;

    if (policyToRun) {
      const authorized = await policyToRun.authorize(
        authContext,
        request.params.resource ?? request.body,
      );
      if (!authorized) {
        this.logDenial(request, authContext, requestId, "FORBIDDEN_OWNERSHIP");
        throw new SecurityException("FORBIDDEN_OWNERSHIP");
      }
    }

    return true;
  }

  private logDenial(
    request: SecurityRequest,
    authContext: AuthContext,
    requestId: string,
    code: string,
  ): void {
    securityLogger.logDenial({
      requestId,
      code,
      userId: authContext.principal.userId,
      schoolId: authContext.tenant.schoolId,
      method: request.method,
      path: request.path,
    });
  }
}
