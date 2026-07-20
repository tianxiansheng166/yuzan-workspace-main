import { Module } from "@nestjs/common";
import {
  SubmissionsController,
  AssignmentSubmissionsController,
} from "./submissions.controller.js";
import { SubmissionsService } from "./submissions.service.js";
import { SUBMISSION_REPOSITORY } from "./ports/submission-repository.port.js";
import { SUBMISSION_LOOKUP } from "./ports/submission-lookup.port.js";
import { PrismaSubmissionRepository } from "./infra/prisma-submission.repository.js";
import { PrismaSubmissionLookupRepository } from "./ports/prisma-submission-lookup.repository.js";
import { StorageModule } from "../../shared/storage/storage.module.js";

@Module({
  imports: [StorageModule],
  controllers: [SubmissionsController, AssignmentSubmissionsController],
  providers: [
    SubmissionsService,
    {
      provide: SUBMISSION_REPOSITORY,
      useClass: PrismaSubmissionRepository,
    },
    {
      provide: SUBMISSION_LOOKUP,
      useClass: PrismaSubmissionLookupRepository,
    },
  ],
  exports: [SubmissionsService, SUBMISSION_LOOKUP],
})
export class SubmissionsModule {}
