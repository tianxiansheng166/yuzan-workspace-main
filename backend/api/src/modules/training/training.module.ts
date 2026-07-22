import { Module } from "@nestjs/common";
import { TrainingController } from "./training.controller.js";
import { TrainingService } from "./training.service.js";
import { TRAINING_REPOSITORY } from "./ports/training-repository.port.js";
import { PrismaTrainingRepository } from "./infra/prisma-training.repository.js";

@Module({
  controllers: [TrainingController],
  providers: [
    TrainingService,
    {
      provide: TRAINING_REPOSITORY,
      useClass: PrismaTrainingRepository,
    },
  ],
  exports: [TrainingService],
})
export class TrainingModule {}
