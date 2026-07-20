import { Module } from "@nestjs/common";
import { ReportingController, StudentGrowthController } from "./reporting.controller.js";
import { ReportingService } from "./reporting.service.js";
import { REPORT_REPOSITORY } from "./ports/report-repository.port.js";
import { PrismaReportRepository } from "./infra/prisma-report.repository.js";
import { LEARNING_PLAN_REPOSITORY } from "./ports/learning-plan-repository.port.js";
import { PrismaLearningPlanRepository } from "./infra/prisma-learning-plan.repository.js";

@Module({
  controllers: [ReportingController, StudentGrowthController],
  providers: [
    ReportingService,
    {
      provide: REPORT_REPOSITORY,
      useClass: PrismaReportRepository,
    },
    {
      provide: LEARNING_PLAN_REPOSITORY,
      useClass: PrismaLearningPlanRepository,
    },
  ],
  exports: [ReportingService],
})
export class ReportingModule {}
