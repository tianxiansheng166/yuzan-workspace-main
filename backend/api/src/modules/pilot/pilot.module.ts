import { Module } from "@nestjs/common";
import { HealthModule } from "../health/health.module.js";
import { PilotController } from "./pilot.controller.js";
import { PilotFeedbackService } from "./pilot-feedback.service.js";
import { PilotObservabilityService } from "./pilot-observability.service.js";

@Module({
  imports: [HealthModule],
  controllers: [PilotController],
  providers: [PilotFeedbackService, PilotObservabilityService],
})
export class PilotModule {}
