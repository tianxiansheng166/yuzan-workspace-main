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
import { PrismaIdentityRepository } from "./adapters/prisma-identity.repository.js";
import { ScryptPasswordVerifier } from "./adapters/scrypt-password-verifier.js";
import { SystemClock } from "./adapters/system-clock.js";
import { CryptoSessionTokenService } from "./adapters/crypto-session-token.service.js";

@Module({
  controllers: [IdentityController],
  providers: [
    IdentityService,
    PrismaIdentityRepository,
    {
      provide: USER_IDENTITY_REPOSITORY,
      useExisting: PrismaIdentityRepository,
    },
    {
      provide: MEMBERSHIP_REPOSITORY,
      useExisting: PrismaIdentityRepository,
    },
    {
      provide: SESSION_REPOSITORY,
      useExisting: PrismaIdentityRepository,
    },
    {
      provide: PASSWORD_VERIFIER,
      useClass: ScryptPasswordVerifier,
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
  exports: [IdentityService, PASSWORD_VERIFIER],
})
export class IdentityModule {}
