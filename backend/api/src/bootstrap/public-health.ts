import { IS_PUBLIC_KEY } from "../common/security/public.decorator.js";
import { HealthController } from "../modules/health/health.controller.js";

/**
 * Root composition owns which infrastructure endpoints bypass global auth.
 * Feature/business controllers are never added here.
 */
export function markRootHealthRoutesPublic(): void {
  Reflect.defineMetadata(IS_PUBLIC_KEY, true, HealthController);
}
