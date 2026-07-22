import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Mark a route or controller as publicly accessible.
 *
 * AuthenticationGuard will skip authentication for handlers decorated
 * with @Public(). Use sparingly and only for health, login or demo routes.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
