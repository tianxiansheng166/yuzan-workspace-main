import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import {
  AUTH_CONTEXT_SOURCE,
  AuthenticationGuard,
  PolicyGuard,
  TenantAuthorizationGuard,
} from "../../common/security/index.js";
import { DenyAllAuthContextSource } from "./deny-all-auth-context.source.js";

const authContextSourceProvider = {
  provide: AUTH_CONTEXT_SOURCE,
  useClass: DenyAllAuthContextSource,
} as const;

/**
 * Security and tenant authorization baseline module.
 *
 * When this module is imported by the root AppModule, the guards registered
 * via APP_GUARD become global and enforce deny-by-default for every route
 * except those explicitly marked with @Public().
 *
 * GOV-006 intentionally does not import AuthModule into AppModule, so the
 * baseline is wired but not globally active until a future task connects it.
 *
 * The default AuthContextSource is DenyAllAuthContextSource, which always
 * returns null. This guarantees fail-closed behavior even if the module is
 * imported accidentally before a real identity service is ready.
 */
@Module({
  providers: [
    authContextSourceProvider,
    AuthenticationGuard,
    TenantAuthorizationGuard,
    PolicyGuard,
    {
      provide: APP_GUARD,
      useExisting: AuthenticationGuard,
    },
    {
      provide: APP_GUARD,
      useExisting: TenantAuthorizationGuard,
    },
    {
      provide: APP_GUARD,
      useExisting: PolicyGuard,
    },
  ],
  exports: [
    authContextSourceProvider,
    AuthenticationGuard,
    TenantAuthorizationGuard,
    PolicyGuard,
  ],
})
export class AuthModule {}
