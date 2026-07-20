import { Module } from "@nestjs/common";
import { TeacherToolsController } from "./teacher-tools.controller.js";
import { TeacherToolsService } from "./teacher-tools.service.js";

@Module({
  controllers: [TeacherToolsController],
  providers: [TeacherToolsService],
  exports: [TeacherToolsService],
})
export class TeacherToolsModule {}
