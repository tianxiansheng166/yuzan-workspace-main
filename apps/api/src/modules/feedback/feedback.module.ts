import { Module } from "@nestjs/common";
import {
  SubmissionFeedbackController,
  SchoolFeedbackController,
} from "./feedback.controller.js";
import { FeedbackService } from "./feedback.service.js";
import { FEEDBACK_REPOSITORY } from "./ports/feedback-repository.port.js";
import { PrismaFeedbackRepository } from "./infra/prisma-feedback.repository.js";
import { SubmissionsModule } from "../submissions/submissions.module.js";

@Module({
  imports: [SubmissionsModule],
  controllers: [SubmissionFeedbackController, SchoolFeedbackController],
  providers: [
    FeedbackService,
    {
      provide: FEEDBACK_REPOSITORY,
      useClass: PrismaFeedbackRepository,
    },
  ],
  exports: [FeedbackService, FEEDBACK_REPOSITORY],
})
export class FeedbackModule {}

