import { Module } from "@nestjs/common";
import { OrganizationsModule } from "../organizations/organizations.module.js";
import { ClassesController } from "./classes.controller.js";
import { ClassesService } from "./classes.service.js";
import { PrismaClassRepository } from "./infra/prisma-class.repository.js";
import { CLASS_REPOSITORY } from "./ports/class-repository.port.js";

@Module({
  imports: [OrganizationsModule],
  controllers: [ClassesController],
  providers: [
    ClassesService,
    {
      provide: CLASS_REPOSITORY,
      useClass: PrismaClassRepository,
    },
  ],
  exports: [ClassesService],
})
export class ClassesModule {}
