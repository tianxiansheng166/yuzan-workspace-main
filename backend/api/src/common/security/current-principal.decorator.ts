import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Principal } from "./auth.types.js";

/**
 * Inject the authenticated principal into a controller handler.
 *
 * Throws if the route was not protected by AuthenticationGuard.
 */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal => {
    const request = context.switchToHttp().getRequest<{
      principal?: Principal;
    }>();
    if (!request.principal) {
      throw new Error("CurrentPrincipal used outside of AuthenticationGuard");
    }
    return request.principal;
  },
);
