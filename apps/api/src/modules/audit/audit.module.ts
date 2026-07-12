import { Module } from "@nestjs/common";
import { AuditController } from "./audit/audit.controller.js";
import { AuditService } from "./audit/audit.service.js";
import { AUDIT_REPOSITORY } from "./ports/audit-repository.port.js";
import { UnavailableAuditRepository } from "./ports/unavailable-audit.repository.js";
import { ProvidersController } from "./providers/providers.controller.js";
import { ProvidersService } from "./providers/providers.service.js";
import { PROVIDER_REPOSITORY } from "./ports/provider-repository.port.js";
import { PROVIDER_SECRET_REPOSITORY } from "./ports/provider-secret-repository.port.js";
import { UnavailableProviderRepository } from "./ports/unavailable-provider.repository.js";
import { UnavailableProviderSecretRepository } from "./ports/unavailable-provider-secret.repository.js";

@Module({
  controllers: [AuditController, ProvidersController],
  providers: [
    AuditService,
    ProvidersService,
    {
      provide: AUDIT_REPOSITORY,
      useClass: UnavailableAuditRepository,
    },
    {
      provide: PROVIDER_REPOSITORY,
      useClass: UnavailableProviderRepository,
    },
    {
      provide: PROVIDER_SECRET_REPOSITORY,
      useClass: UnavailableProviderSecretRepository,
    },
  ],
  exports: [AuditService, ProvidersService],
})
export class AuditModule {}
