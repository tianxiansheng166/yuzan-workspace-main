import { Module } from "@nestjs/common";
import { AssessmentSessionController, AssessmentDeviceController } from "./assessment.controller.js";
import { PracticeController } from "./practice.controller.js";
import { PracticeService } from "./practice.service.js";
import { AssessmentService } from "./assessment.service.js";
import { ASSESSMENT_SESSION_REPOSITORY } from "./ports/assessment-session-repository.port.js";
import { ASSESSMENT_ITEM_REPOSITORY } from "./ports/assessment-item-repository.port.js";
import { WRITTEN_ANSWER_REPOSITORY } from "./ports/written-answer-repository.port.js";
import { ASSESSMENT_REPORT_REPOSITORY } from "./ports/assessment-report-repository.port.js";
import { PrismaAssessmentSessionRepository } from "./infra/prisma-assessment-session.repository.js";
import { PrismaAssessmentItemRepository } from "./infra/prisma-assessment-item.repository.js";
import { PrismaWrittenAnswerRepository } from "./infra/prisma-written-answer.repository.js";
import { PrismaAssessmentReportRepository } from "./infra/prisma-assessment-report.repository.js";

@Module({
  controllers: [AssessmentSessionController, AssessmentDeviceController, PracticeController],
  providers: [
    AssessmentService,
    PracticeService,
    {
      provide: ASSESSMENT_SESSION_REPOSITORY,
      useClass: PrismaAssessmentSessionRepository,
    },
    {
      provide: ASSESSMENT_ITEM_REPOSITORY,
      useClass: PrismaAssessmentItemRepository,
    },
    {
      provide: WRITTEN_ANSWER_REPOSITORY,
      useClass: PrismaWrittenAnswerRepository,
    },
    {
      provide: ASSESSMENT_REPORT_REPOSITORY,
      useClass: PrismaAssessmentReportRepository,
    },
  ],
  exports: [AssessmentService],
})
export class AssessmentModule {}
