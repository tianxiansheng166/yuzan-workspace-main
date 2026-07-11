import { Module } from "@nestjs/common";
import { TrainingController } from "./training.controller.js";
import { TrainingService } from "./training.service.js";
import { TRAINING_REPOSITORY } from "./ports/training-repository.port.js";
import { UnavailableTrainingRepository } from "./ports/unavailable-training.repository.js";

@Module({
  controllers: [TrainingController],
  providers: [
    TrainingService,
    {
      provide: TRAINING_REPOSITORY,
      useClass: UnavailableTrainingRepository,
    },
  ],
  exports: [TrainingService],
})
export class TrainingModule {}
