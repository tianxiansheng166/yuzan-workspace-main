import { Module } from "@nestjs/common";
import {
  CLOCK,
  MEMBERSHIP_REPOSITORY,
  PASSWORD_VERIFIER,
  SESSION_REPOSITORY,
  SESSION_TOKEN_SERVICE,
  USER_IDENTITY_REPOSITORY,
} from "./ports/index.js";
import { IdentityController } from "./identity.controller.js";
import { IdentityService } from "./identity.service.js";
import { UnavailableIdentityRepository } from "./adapters/unavailable-identity.repository.js";
import { UnavailableSessionRepository } from "./adapters/unavailable-session.repository.js";
import { DenyPasswordVerifier } from "./adapters/deny-password-verifier.js";
import { SystemClock } from "./adapters/system-clock.js";
import { CryptoSessionTokenService } from "./adapters/crypto-session-token.service.js";

@Module({
  controllers: [IdentityController],
  providers: [
    IdentityService,
    {
      provide: USER_IDENTITY_REPOSITORY,
      useClass: UnavailableIdentityRepository,
    },
    {
      provide: MEMBERSHIP_REPOSITORY,
      useClass: UnavailableIdentityRepository,
    },
    {
      provide: SESSION_REPOSITORY,
      useClass: UnavailableSessionRepository,
    },
    {
      provide: PASSWORD_VERIFIER,
      useClass: DenyPasswordVerifier,
    },
    {
      provide: SESSION_TOKEN_SERVICE,
      useClass: CryptoSessionTokenService,
    },
    {
      provide: CLOCK,
      useClass: SystemClock,
    },
  ],
  exports: [IdentityService],
})
export class IdentityModule {}
