import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { TenantContext } from "./auth.types.js";

/**
 * Inject the current tenant context into a controller handler.
 *
 * Throws if the route was not protected by TenantAuthorizationGuard.
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TenantContext => {
    const request = context.switchToHttp().getRequest<{
      tenant?: TenantContext;
    }>();
    if (!request.tenant) {
      throw new Error("CurrentTenant used outside of TenantAuthorizationGuard");
    }
    return request.tenant;
  },
);
