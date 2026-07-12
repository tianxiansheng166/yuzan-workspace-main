import { Module } from "@nestjs/common";
import { GovernanceController } from "./governance.controller.js";
import { GovernanceService } from "./governance.service.js";
import { GOVERNANCE_REPOSITORY } from "./ports/governance-repository.port.js";
import { GOVERNANCE_REVIEW_REPOSITORY } from "./ports/governance-review-repository.port.js";
import { UnavailableGovernanceRepository } from "./ports/unavailable-governance.repository.js";
import { UnavailableReviewRepository } from "./ports/unavailable-review.repository.js";

@Module({
  controllers: [GovernanceController],
  providers: [
    GovernanceService,
    {
      provide: GOVERNANCE_REPOSITORY,
      useClass: UnavailableGovernanceRepository,
    },
    {
      provide: GOVERNANCE_REVIEW_REPOSITORY,
      useClass: UnavailableReviewRepository,
    },
  ],
  exports: [GovernanceService],
})
export class CurriculumGovernanceModule {}
