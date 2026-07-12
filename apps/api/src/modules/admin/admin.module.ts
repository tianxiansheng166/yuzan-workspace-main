import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard/dashboard.controller.js";
import { DashboardService } from "./dashboard/dashboard.service.js";
import { PrismaAdminMetrics } from "./infra/prisma-admin-metrics.js";
import { PrismaAdminSchoolRepository } from "./infra/prisma-admin-school.repository.js";
import { PrismaAdminUserRepository } from "./infra/prisma-admin-user.repository.js";
import { ADMIN_METRICS_PORT } from "./ports/admin-metrics.port.js";
import { ADMIN_SCHOOL_REPOSITORY } from "./ports/admin-school-repository.port.js";
import { ADMIN_USER_REPOSITORY } from "./ports/admin-user-repository.port.js";
import { AdminSchoolsController } from "./schools/schools.controller.js";
import { SchoolsService } from "./schools/schools.service.js";
import { AdminUsersController } from "./users/users.controller.js";
import { UsersService } from "./users/users.service.js";

@Module({
  controllers: [DashboardController, AdminSchoolsController, AdminUsersController],
  providers: [
    DashboardService,
    SchoolsService,
    UsersService,
    {
      provide: ADMIN_METRICS_PORT,
      useClass: PrismaAdminMetrics,
    },
    {
      provide: ADMIN_SCHOOL_REPOSITORY,
      useClass: PrismaAdminSchoolRepository,
    },
    {
      provide: ADMIN_USER_REPOSITORY,
      useClass: PrismaAdminUserRepository,
    },
  ],
  exports: [DashboardService, SchoolsService, UsersService],
})
export class AdminModule {}
