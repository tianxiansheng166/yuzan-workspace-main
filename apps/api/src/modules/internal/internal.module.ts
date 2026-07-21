import { Module } from "@nestjs/common";
import { AssessmentModule } from "../assessment/assessment.module.js";
import { AiLessonPlanningModule } from "../ai-lesson-planning/ai-lesson-planning.module.js";
import { InternalController } from "./internal.controller.js";

@Module({
  imports: [AssessmentModule, AiLessonPlanningModule],
  controllers: [InternalController],
})
export class InternalModule {}
