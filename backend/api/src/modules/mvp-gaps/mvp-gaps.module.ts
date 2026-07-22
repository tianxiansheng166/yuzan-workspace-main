import { Module } from "@nestjs/common";
import { AdminStubController } from "./admin-stub.controller.js";
import { AuditStubController } from "./audit-stub.controller.js";
import { PlansStubController } from "./plans-stub.controller.js";
import { ResearchStubController } from "./research-stub.controller.js";
import { AssessmentLinkController } from "./assessment-link.controller.js";
import { StorageModule } from "../../shared/storage/storage.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { InviteRedeemController } from "./invite-redeem.controller.js";

@Module({
  imports: [StorageModule, IdentityModule],
  controllers: [
    AdminStubController,
    AuditStubController,
    PlansStubController,
    ResearchStubController,
    AssessmentLinkController,
    InviteRedeemController,
  ],
})
export class MvpGapsModule {}
