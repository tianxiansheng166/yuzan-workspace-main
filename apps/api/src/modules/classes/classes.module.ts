import { Module } from "@nestjs/common";
import { ClassesController } from "./classes.controller.js";
import { ClassesService } from "./classes.service.js";
import { CLASS_REPOSITORY } from "./ports/class-repository.port.js";
import { UnavailableClassRepository } from "./ports/unavailable-class.repository.js";

@Module({
  controllers: [ClassesController],
  providers: [
    ClassesService,
    {
      provide: CLASS_REPOSITORY,
      useClass: UnavailableClassRepository,
    },
  ],
  exports: [ClassesService],
})
export class ClassesModule {}
