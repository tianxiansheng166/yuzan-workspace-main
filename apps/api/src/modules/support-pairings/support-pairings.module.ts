import { Module } from "@nestjs/common";
import { SupportPairingsController } from "./support-pairings.controller.js";
import { SupportPairingsService } from "./support-pairings.service.js";
import { SUPPORT_PAIRING_REPOSITORY } from "./ports/support-pairing-repository.port.js";
import { PrismaSupportPairingRepository } from "./infra/prisma-support-pairing.repository.js";

@Module({
  controllers: [SupportPairingsController],
  providers: [
    SupportPairingsService,
    {
      provide: SUPPORT_PAIRING_REPOSITORY,
      useClass: PrismaSupportPairingRepository,
    },
  ],
  exports: [SupportPairingsService],
})
export class SupportPairingsModule {}
