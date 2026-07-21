import { Module } from "@nestjs/common";
import { StudentCoursesController, StudentActivityNotesController } from "./student-courses.controller.js";
import { StudentCoursesService } from "./student-courses.service.js";

@Module({
  controllers: [StudentCoursesController, StudentActivityNotesController],
  providers: [StudentCoursesService],
  exports: [StudentCoursesService],
})
export class StudentCoursesModule {}
