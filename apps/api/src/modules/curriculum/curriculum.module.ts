import { Module } from "@nestjs/common";
import { PrismaClient } from "@yuzan/database";
import { PrismaPg } from "@prisma/adapter-pg";
import { RESOURCE_LOOKUP_PORT } from "../resources/ports/resource-lookup.port.js";
import { UnavailableResourceLookupAdapter } from "../resources/ports/unavailable-resource-lookup.adapter.js";
import { CurriculumController } from "./curriculum.controller.js";
import { CurriculumService } from "./curriculum.service.js";
import { COURSE_VERSION_REPOSITORY } from "./ports/course-version-repository.port.js";
import { PrismaCourseVersionRepository } from "./ports/prisma-course-version.repository.js";

@Module({
  controllers: [CurriculumController],
  providers: [
    CurriculumService,
    {
      provide: PrismaClient,
      useFactory: () => {
        const adapter = new PrismaPg(process.env.DATABASE_URL ?? "");
        return new PrismaClient({ adapter });
      },
    },
    {
      provide: COURSE_VERSION_REPOSITORY,
      useClass: PrismaCourseVersionRepository,
    },
    {
      provide: RESOURCE_LOOKUP_PORT,
      useClass: UnavailableResourceLookupAdapter,
    },
  ],
  exports: [CurriculumService],
})
export class CurriculumModule {}
