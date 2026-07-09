import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import {
  AUTH_CONTEXT_SOURCE,
  AuthenticationGuard,
  PolicyGuard,
  TenantAuthorizationGuard,
} from "../../common/security/index.js";
import { StubAuthContextSource } from "./stub-auth-context.source.js";

/**
 * Security and tenant authorization baseline module.
 *
 * When this module is imported by the root AppModule, the guards registered
 * via APP_GUARD become global and enforce deny-by-default for every route
 * except those explicitly marked with @Public().
 *
 * GOV-006 intentionally does not import AuthModule into AppModule, so the
 * baseline is wired but not globally active until a future task connects it.
 */
@Module({
  providers: [
    {
      provide: AUTH_CONTEXT_SOURCE,
      useClass: StubAuthContextSource,
    },
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantAuthorizationGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PolicyGuard,
    },
  ],
  exports: [
    {
      provide: AUTH_CONTEXT_SOURCE,
      useClass: StubAuthContextSource,
    },
    AuthenticationGuard,
    TenantAuthorizationGuard,
    PolicyGuard,
  ],
})
export class AuthModule {}
