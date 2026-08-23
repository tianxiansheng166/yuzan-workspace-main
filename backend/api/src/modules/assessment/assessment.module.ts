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
import { QuestionBankDeterministicScoringService } from "./question-bank-deterministic-scoring.service.js";
import { AssessmentReviewController } from "./assessment-review.controller.js";
import { AssessmentReviewService } from "./assessment-review.service.js";
import { QuestionBankProgressController } from "./question-bank-progress.controller.js";
import { QuestionBankProgressService } from "./question-bank-progress.service.js";
import { TeacherQuestionBankDiagnosticController } from "./teacher-question-bank-diagnostic.controller.js";
import { TeacherQuestionBankDiagnosticService } from "./teacher-question-bank-diagnostic.service.js";

@Module({
  controllers: [AssessmentSessionController, AssessmentDeviceController, PracticeController, AssessmentReviewController, QuestionBankProgressController, TeacherQuestionBankDiagnosticController],
  providers: [
    AssessmentService,
    PracticeService,
    QuestionBankDeterministicScoringService,
    AssessmentReviewService,
    QuestionBankProgressService,
    TeacherQuestionBankDiagnosticService,
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
