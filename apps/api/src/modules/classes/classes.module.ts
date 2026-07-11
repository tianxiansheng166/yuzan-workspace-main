import { Module } from "@nestjs/common";
import { ClassesController } from "./classes.controller.js";
import { ClassesService } from "./classes.service.js";
import { CLASS_REPOSITORY } from "./ports/class-repository.port.js";
import { CLASS_ENROLLMENT_LOOKUP } from "./ports/class-enrollment-lookup.port.js";
import { PrismaClassRepository } from "./infra/prisma-class.repository.js";

@Module({
  controllers: [ClassesController],
  providers: [
    ClassesService,
    {
      provide: CLASS_REPOSITORY,
      useClass: PrismaClassRepository,
    },
    {
      provide: CLASS_ENROLLMENT_LOOKUP,
      useClass: PrismaClassRepository,
    },
  ],
  exports: [ClassesService, CLASS_ENROLLMENT_LOOKUP],
})
export class ClassesModule {}
