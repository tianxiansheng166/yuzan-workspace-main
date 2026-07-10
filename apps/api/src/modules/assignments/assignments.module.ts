import { Module } from "@nestjs/common";
import { CLASS_REPOSITORY } from "../classes/ports/class-repository.port.js";
import { COURSE_VERSION_REPOSITORY } from "../curriculum/ports/course-version-repository.port.js";
import { AssignmentsController } from "./assignments.controller.js";
import { AssignmentsService } from "./assignments.service.js";
import { ASSIGNMENT_REPOSITORY } from "./ports/assignment-repository.port.js";
import { UnavailableAssignmentRepository } from "./ports/unavailable-assignment.repository.js";
import { UnavailableClassRepository } from "./ports/unavailable-class.repository.js";
import { UnavailableCourseVersionRepository } from "./ports/unavailable-course-version.repository.js";
import { CLOCK, SystemClock } from "./ports/clock.port.js";

@Module({
  controllers: [AssignmentsController],
  providers: [
    AssignmentsService,
    {
      provide: ASSIGNMENT_REPOSITORY,
      useClass: UnavailableAssignmentRepository,
    },
    {
      provide: CLASS_REPOSITORY,
      useClass: UnavailableClassRepository,
    },
    {
      provide: COURSE_VERSION_REPOSITORY,
      useClass: UnavailableCourseVersionRepository,
    },
    {
      provide: CLOCK,
      useClass: SystemClock,
    },
  ],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
