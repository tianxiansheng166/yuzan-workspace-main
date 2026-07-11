import { Module } from "@nestjs/common";
import { OfflineController, SyncBatchController } from "./offline.controller.js";
import { OfflineService } from "./offline.service.js";
import { OFFLINE_REPOSITORY } from "./ports/offline-repository.port.js";
import { PrismaOfflineRepository } from "./infra/prisma-offline.repository.js";

@Module({
  controllers: [OfflineController, SyncBatchController],
  providers: [
    OfflineService,
    { provide: OFFLINE_REPOSITORY, useClass: PrismaOfflineRepository },
  ],
  exports: [OfflineService],
})
export class OfflineModule {}
