import { Module } from "@nestjs/common";
import { RESOURCE_LOOKUP_PORT } from "./ports/resource-lookup.port.js";
import { ResourcesController } from "./resources.controller.js";
import { ResourcesService } from "./resources.service.js";

@Module({
  controllers: [ResourcesController],
  providers: [
    ResourcesService,
    { provide: RESOURCE_LOOKUP_PORT, useExisting: ResourcesService },
  ],
  exports: [ResourcesService, RESOURCE_LOOKUP_PORT],
})
export class ResourcesModule {}
