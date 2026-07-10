import { Module } from "@nestjs/common";
import { OrganizationsController } from "./organizations.controller.js";
import { OrganizationsService } from "./organizations.service.js";
import { MEMBERSHIP_REPOSITORY } from "./ports/membership-repository.port.js";
import { SCHOOL_REPOSITORY } from "./ports/school-repository.port.js";
import { UnavailableMembershipRepository } from "./ports/unavailable-membership.repository.js";
import { UnavailableSchoolRepository } from "./ports/unavailable-school.repository.js";

@Module({
  controllers: [OrganizationsController],
  providers: [
    OrganizationsService,
    {
      provide: SCHOOL_REPOSITORY,
      useClass: UnavailableSchoolRepository,
    },
    {
      provide: MEMBERSHIP_REPOSITORY,
      useClass: UnavailableMembershipRepository,
    },
  ],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
