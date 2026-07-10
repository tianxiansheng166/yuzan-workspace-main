import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { LivenessService } from "./liveness.service.js";
import { ReadinessService } from "./readiness.service.js";
import { StartupService } from "./startup.service.js";

@Module({
  controllers: [HealthController],
  providers: [
    LivenessService,
    {
      provide: ReadinessService,
      useFactory: () => new ReadinessService(),
    },
    StartupService,
  ],
  exports: [LivenessService, ReadinessService, StartupService],
})
export class HealthModule {}
