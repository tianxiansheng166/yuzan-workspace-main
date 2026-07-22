import { Module } from "@nestjs/common";
import { StudentDashboardController } from "./student-dashboard.controller.js";
import { StudentDashboardService } from "./student-dashboard.service.js";
import { FeedbackModule } from "../feedback/feedback.module.js";

@Module({
  imports: [FeedbackModule],
  controllers: [StudentDashboardController],
  providers: [StudentDashboardService],
  exports: [StudentDashboardService],
})
export class StudentDashboardModule {}
