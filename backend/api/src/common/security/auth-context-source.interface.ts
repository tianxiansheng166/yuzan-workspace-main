import type { ExecutionContext } from "@nestjs/common";
import type { AuthContext } from "./auth.types.js";

/**
 * Abstraction over authentication/session resolution.
 *
 * GOV-006 only defines the interface and a stub/demo adapter. IDN-001 will
 * provide a real implementation that resolves the principal from session,
 * cookie or token without exposing secrets.
 */
export interface AuthContextSource {
  resolve(
    context: ExecutionContext,
  ): AuthContext | null | Promise<AuthContext | null>;
}

export const AUTH_CONTEXT_SOURCE = Symbol("AUTH_CONTEXT_SOURCE");
