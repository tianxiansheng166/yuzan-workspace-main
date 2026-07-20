import { Module } from "@nestjs/common";
import {
  TeacherController,
  NotificationController,
} from "./teacher.controller.js";
import { TeacherService } from "./teacher.service.js";

@Module({
  controllers: [TeacherController, NotificationController],
  providers: [TeacherService],
  exports: [TeacherService],
})
export class TeacherModule {}
