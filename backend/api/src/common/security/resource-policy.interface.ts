import type { AuthContext } from "./auth.types.js";

/**
 * Resource-bound authorization policy.
 *
 * Feature modules (IDN-001/ORG-001/CUR-001) implement this interface to
 * enforce ownership or fine-grained access rules beyond role/permission checks.
 *
 * Example: a submission policy may verify that the submission's enrollment
 * belongs to the current principal.
 */
export interface ResourcePolicy<T = unknown> {
  authorize(context: AuthContext, resource: T): boolean | Promise<boolean>;
}

export const RESOURCE_POLICY_KEY = "resourcePolicy";
