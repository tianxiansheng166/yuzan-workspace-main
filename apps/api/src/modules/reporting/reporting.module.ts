import { Module } from "@nestjs/common";
import { ReportingController, StudentGrowthController } from "./reporting.controller.js";
import { ReportingService } from "./reporting.service.js";
import { REPORT_REPOSITORY } from "./ports/report-repository.port.js";
import { PrismaReportRepository } from "./infra/prisma-report.repository.js";

@Module({
  controllers: [ReportingController, StudentGrowthController],
  providers: [
    ReportingService,
    {
      provide: REPORT_REPOSITORY,
      useClass: PrismaReportRepository,
    },
  ],
  exports: [ReportingService],
})
export class ReportingModule {}
