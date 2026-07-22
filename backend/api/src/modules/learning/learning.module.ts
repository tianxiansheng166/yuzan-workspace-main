import { Module } from "@nestjs/common";
import { LearningController } from "./learning.controller.js";
import { LearningService } from "./learning.service.js";
import { LEARNING_REPOSITORY } from "./ports/learning-repository.port.js";
import { PrismaLearningRepository } from "./infra/prisma-learning.repository.js";
import { ClassesModule } from "../classes/classes.module.js";
import { AssignmentsModule } from "../assignments/assignments.module.js";

@Module({
  imports: [ClassesModule, AssignmentsModule],
  controllers: [LearningController],
  providers: [
    LearningService,
    {
      provide: LEARNING_REPOSITORY,
      useClass: PrismaLearningRepository,
    },
  ],
  exports: [LearningService],
})
export class LearningModule {}
