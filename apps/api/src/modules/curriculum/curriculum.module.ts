import { Module } from "@nestjs/common";
import { RESOURCE_LOOKUP_PORT } from "../resources/ports/resource-lookup.port.js";
import { UnavailableResourceLookupAdapter } from "../resources/ports/unavailable-resource-lookup.adapter.js";
import { CurriculumController } from "./curriculum.controller.js";
import { CurriculumService } from "./curriculum.service.js";
import { COURSE_VERSION_REPOSITORY } from "./ports/course-version-repository.port.js";
import { UnavailableCourseVersionRepository } from "./ports/unavailable-course-version.repository.js";

@Module({
  controllers: [CurriculumController],
  providers: [
    CurriculumService,
    {
      provide: COURSE_VERSION_REPOSITORY,
      useClass: UnavailableCourseVersionRepository,
    },
    {
      provide: RESOURCE_LOOKUP_PORT,
      useClass: UnavailableResourceLookupAdapter,
    },
  ],
  exports: [CurriculumService],
})
export class CurriculumModule {}
