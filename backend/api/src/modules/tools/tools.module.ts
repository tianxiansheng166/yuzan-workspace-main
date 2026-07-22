import { Module } from "@nestjs/common";
import { ToolsController } from "./tools.controller.js";
import { TeacherToolsController, ExternalServicesController } from "./teacher-tools.controller.js";
import { ToolsService } from "./tools.service.js";
import { TOOL_REPOSITORY } from "./ports/tool-repository.port.js";
import { UnavailableToolRepository } from "./ports/unavailable-tool.repository.js";

@Module({
  controllers: [ToolsController, TeacherToolsController, ExternalServicesController],
  providers: [
    ToolsService,
    {
      provide: TOOL_REPOSITORY,
      useClass: UnavailableToolRepository,
    },
  ],
  exports: [ToolsService],
})
export class ToolsModule {}
