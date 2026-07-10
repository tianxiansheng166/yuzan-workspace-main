import { Module } from "@nestjs/common";
import { ASSIGNMENT_REPOSITORY } from "../assignments/ports/assignment-repository.port.js";
import { UnavailableAssignmentRepository } from "../assignments/ports/unavailable-assignment.repository.js";
import { CLASS_REPOSITORY } from "../classes/ports/class-repository.port.js";
import { UnavailableClassRepository } from "../classes/ports/unavailable-class.repository.js";
import { COURSE_VERSION_REPOSITORY } from "../curriculum/ports/course-version-repository.port.js";
import { UnavailableCourseVersionRepository } from "../curriculum/ports/unavailable-course-version.repository.js";
import { LearningController } from "./learning.controller.js";
import { LearningService } from "./learning.service.js";
import { LEARNING_REPOSITORY } from "./ports/learning-repository.port.js";
import { UnavailableLearningRepository } from "./ports/unavailable-learning.repository.js";

@Module({
  controllers: [LearningController],
  providers: [
    LearningService,
    {
      provide: LEARNING_REPOSITORY,
      useClass: UnavailableLearningRepository,
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
  ],
  exports: [LearningService],
})
export class LearningModule {}
