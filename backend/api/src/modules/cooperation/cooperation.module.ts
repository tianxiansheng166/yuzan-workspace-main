import { Module } from "@nestjs/common";
import { CooperationController } from "./cooperation.controller.js";
import { CooperationService } from "./cooperation.service.js";
import { COOPERATION_REPOSITORY } from "./ports/cooperation-repository.port.js";
import { UnavailableCooperationRepository } from "./ports/unavailable-cooperation.repository.js";

@Module({
  controllers: [CooperationController],
  providers: [
    CooperationService,
    {
      provide: COOPERATION_REPOSITORY,
      useClass: UnavailableCooperationRepository,
    },
  ],
  exports: [CooperationService],
})
export class CooperationModule {}
