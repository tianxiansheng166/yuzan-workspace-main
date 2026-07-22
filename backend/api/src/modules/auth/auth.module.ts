import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import {
  AUTH_CONTEXT_SOURCE,
  AuthenticationGuard,
  PolicyGuard,
  TenantAuthorizationGuard,
} from "../../common/security/index.js";
import { IdentityModule } from "../identity/identity.module.js";
import { SessionAuthContextSource } from "./session-auth-context.source.js";

const authContextSourceProvider = {
  provide: AUTH_CONTEXT_SOURCE,
  useClass: SessionAuthContextSource,
} as const;

/**
 * Security and tenant authorization baseline module.
 *
 * When this module is imported by the root AppModule, the guards registered
 * via APP_GUARD become global and enforce deny-by-default for every route
 * except those explicitly marked with @Public().
 *
 * The source resolves opaque access tokens through the persistent identity
 * service. Missing, expired, revoked, or unauthorized sessions fail closed.
 */
@Module({
  imports: [IdentityModule],
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
