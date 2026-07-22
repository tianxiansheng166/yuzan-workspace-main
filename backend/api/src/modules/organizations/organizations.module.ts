import { Module } from "@nestjs/common";
import { OrganizationsController } from "./organizations.controller.js";
import { OrganizationsService } from "./organizations.service.js";
import { MEMBERSHIP_REPOSITORY } from "./ports/membership-repository.port.js";
import { SCHOOL_REPOSITORY } from "./ports/school-repository.port.js";
import { PrismaMembershipRepository } from "./infra/prisma-membership.repository.js";
import { PrismaSchoolRepository } from "./infra/prisma-school.repository.js";

@Module({
  controllers: [OrganizationsController],
  providers: [
    OrganizationsService,
    {
      provide: SCHOOL_REPOSITORY,
      useClass: PrismaSchoolRepository,
    },
    {
      provide: MEMBERSHIP_REPOSITORY,
      useClass: PrismaMembershipRepository,
    },
  ],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
