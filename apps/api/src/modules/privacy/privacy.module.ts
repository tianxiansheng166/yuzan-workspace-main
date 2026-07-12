import { Module } from "@nestjs/common";
import { RetentionController } from "./retention/retention.controller.js";
import { RetentionService } from "./retention/retention.service.js";
import { ConsentController } from "./consent/consent.controller.js";
import { ConsentService } from "./consent/consent.service.js";
import { DeletionController } from "./deletion/deletion.controller.js";
import { DeletionService } from "./deletion/deletion.service.js";
import { AssessmentController } from "./assessment/assessment.controller.js";
import { AssessmentService } from "./assessment/assessment.service.js";
import { RETENTION_REPOSITORY } from "./ports/retention-repository.port.js";
import { CONSENT_REPOSITORY } from "./ports/consent-repository.port.js";
import { DELETION_REPOSITORY } from "./ports/deletion-repository.port.js";
import { ASSESSMENT_MATERIAL_REPOSITORY } from "./ports/assessment-material-repository.port.js";
import { UnavailableRetentionRepository } from "./ports/unavailable-retention.repository.js";
import { UnavailableConsentRepository } from "./ports/unavailable-consent.repository.js";
import { UnavailableDeletionRepository } from "./ports/unavailable-deletion.repository.js";
import { UnavailableAssessmentMaterialRepository } from "./ports/unavailable-assessment-material.repository.js";

@Module({
  controllers: [
    RetentionController,
    ConsentController,
    DeletionController,
    AssessmentController,
  ],
  providers: [
    RetentionService,
    ConsentService,
    DeletionService,
    AssessmentService,
    {
      provide: RETENTION_REPOSITORY,
      useClass: UnavailableRetentionRepository,
    },
    {
      provide: CONSENT_REPOSITORY,
      useClass: UnavailableConsentRepository,
    },
    {
      provide: DELETION_REPOSITORY,
      useClass: UnavailableDeletionRepository,
    },
    {
      provide: ASSESSMENT_MATERIAL_REPOSITORY,
      useClass: UnavailableAssessmentMaterialRepository,
    },
  ],
  exports: [
    RetentionService,
    ConsentService,
    DeletionService,
    AssessmentService,
  ],
})
export class PrivacyModule {}
