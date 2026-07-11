import { Module } from "@nestjs/common";
import { SupportPairingsController } from "./support-pairings.controller.js";
import { SupportPairingsService } from "./support-pairings.service.js";
import { SUPPORT_PAIRING_REPOSITORY } from "./ports/support-pairing-repository.port.js";
import { UnavailableSupportPairingRepository } from "./ports/unavailable-support-pairing.repository.js";

@Module({
  controllers: [SupportPairingsController],
  providers: [
    SupportPairingsService,
    {
      provide: SUPPORT_PAIRING_REPOSITORY,
      useClass: UnavailableSupportPairingRepository,
    },
  ],
  exports: [SupportPairingsService],
})
export class SupportPairingsModule {}
