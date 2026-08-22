import { Module } from "@nestjs/common";
import { AssessmentModule } from "../assessment/assessment.module.js";
import { AiLessonPlanningModule } from "../ai-lesson-planning/ai-lesson-planning.module.js";
import { SpeechJobModule } from "../speech-job/speech-job.module.js";
import { InternalController } from "./internal.controller.js";

@Module({
  imports: [AssessmentModule, AiLessonPlanningModule, SpeechJobModule],
  controllers: [InternalController],
})
export class InternalModule {}
