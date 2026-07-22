import { Module } from "@nestjs/common";
import { CommunityController } from "./community.controller.js";
import { CommunityService } from "./community.service.js";
import { COMMUNITY_REPOSITORY } from "./ports/community-repository.port.js";
import { UnavailableCommunityRepository } from "./ports/unavailable-community.repository.js";

@Module({
  controllers: [CommunityController],
  providers: [
    CommunityService,
    {
      provide: COMMUNITY_REPOSITORY,
      useClass: UnavailableCommunityRepository,
    },
  ],
  exports: [CommunityService],
})
export class CommunityModule {}
