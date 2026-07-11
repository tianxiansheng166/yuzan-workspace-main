import { Module } from "@nestjs/common";
import { AssignmentsController } from "./assignments.controller.js";
import { AssignmentsService } from "./assignments.service.js";
import { ASSIGNMENT_REPOSITORY } from "./ports/assignment-repository.port.js";
import { ASSIGNMENT_LOOKUP } from "./ports/assignment-lookup.port.js";
import { PrismaAssignmentRepository } from "./infra/prisma-assignment.repository.js";
import { PrismaAssignmentLookupRepository } from "./infra/prisma-assignment-lookup.repository.js";

@Module({
  controllers: [AssignmentsController],
  providers: [
    AssignmentsService,
    {
      provide: ASSIGNMENT_REPOSITORY,
      useClass: PrismaAssignmentRepository,
    },
    {
      provide: ASSIGNMENT_LOOKUP,
      useClass: PrismaAssignmentLookupRepository,
    },
  ],
  exports: [AssignmentsService, ASSIGNMENT_LOOKUP],
})
export class AssignmentsModule {}
