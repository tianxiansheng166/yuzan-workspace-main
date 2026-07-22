import { Module } from "@nestjs/common";
import { VolunteersController } from "./volunteers.controller.js";
import { VolunteersService } from "./volunteers.service.js";
import { VOLUNTEER_REPOSITORY } from "./ports/volunteer-repository.port.js";
import { PrismaVolunteerRepository } from "./infra/prisma-volunteer.repository.js";

@Module({
  controllers: [VolunteersController],
  providers: [
    VolunteersService,
    {
      provide: VOLUNTEER_REPOSITORY,
      useClass: PrismaVolunteerRepository,
    },
  ],
  exports: [VolunteersService],
})
export class VolunteersModule {}
