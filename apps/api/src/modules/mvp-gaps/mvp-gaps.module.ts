import { Module } from "@nestjs/common";
import { AdminStubController } from "./admin-stub.controller.js";
import { AuditStubController } from "./audit-stub.controller.js";
import { AssessmentStubController } from "./assessment-stub.controller.js";
import { PlansStubController } from "./plans-stub.controller.js";
import { ResearchStubController } from "./research-stub.controller.js";

@Module({
  controllers: [
    AdminStubController,
    AuditStubController,
    AssessmentStubController,
    PlansStubController,
    ResearchStubController,
  ],
})
export class MvpGapsModule {}
