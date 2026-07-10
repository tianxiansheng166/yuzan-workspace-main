import { Module } from "@nestjs/common";
import { ASSIGNMENT_REPOSITORY } from "../assignments/ports/assignment-repository.port.js";
import { UnavailableAssignmentRepository } from "../assignments/ports/unavailable-assignment.repository.js";
import { CLOCK, SystemClock } from "../assignments/ports/clock.port.js";
import { CLASS_REPOSITORY } from "../classes/ports/class-repository.port.js";
import { UnavailableClassRepository } from "../classes/ports/unavailable-class.repository.js";
import { COURSE_VERSION_REPOSITORY } from "../curriculum/ports/course-version-repository.port.js";
import { UnavailableCourseVersionRepository } from "../curriculum/ports/unavailable-course-version.repository.js";
import { AssessmentController } from "./assessment.controller.js";
import { AssessmentService } from "./assessment.service.js";
import { ASSESSMENT_REPOSITORY } from "./ports/assessment-repository.port.js";
import { UnavailableAssessmentRepository } from "./ports/unavailable-assessment.repository.js";

@Module({
  controllers: [AssessmentController],
  providers: [
    AssessmentService,
    {
      provide: ASSESSMENT_REPOSITORY,
      useClass: UnavailableAssessmentRepository,
    },
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
  exports: [AssessmentService],
})
export class AssessmentModule {}
