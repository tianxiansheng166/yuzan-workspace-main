import { Module } from "@nestjs/common";
import { PlansController } from "./plans/plans.controller.js";
import { PlansService } from "./plans/plans.service.js";
import { RulesController } from "./rules/rules.controller.js";
import { RulesService } from "./rules/rules.service.js";
import { LinksController } from "./links/links.controller.js";
import { LinksService } from "./links/links.service.js";
import { PLAN_REPOSITORY } from "./ports/plan-repository.port.js";
import { PLAN_VERSION_REPOSITORY } from "./ports/plan-version-repository.port.js";
import { RULE_REPOSITORY } from "./ports/rule-repository.port.js";
import { LINK_REPOSITORY } from "./ports/link-repository.port.js";
import { UnavailablePlanRepository } from "./ports/unavailable-plan.repository.js";
import { UnavailablePlanVersionRepository } from "./ports/unavailable-plan-version.repository.js";
import { UnavailableRuleRepository } from "./ports/unavailable-rule.repository.js";
import { UnavailableLinkRepository } from "./ports/unavailable-link.repository.js";

@Module({
  controllers: [PlansController, RulesController, LinksController],
  providers: [
    PlansService,
    RulesService,
    LinksService,
    {
      provide: PLAN_REPOSITORY,
      useClass: UnavailablePlanRepository,
    },
    {
      provide: PLAN_VERSION_REPOSITORY,
      useClass: UnavailablePlanVersionRepository,
    },
    {
      provide: RULE_REPOSITORY,
      useClass: UnavailableRuleRepository,
    },
    {
      provide: LINK_REPOSITORY,
      useClass: UnavailableLinkRepository,
    },
  ],
  exports: [PlansService, RulesService, LinksService],
})
export class ProductPlansModule {}
