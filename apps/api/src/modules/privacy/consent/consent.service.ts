import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AuthContext } from "../../../common/security/auth.types.js";
import type {
  ConsentVersion,
  ListConsentVersionsOptions,
} from "../domain/privacy.types.js";
import {
  PrivacyForbiddenException,
  ConsentVersionConflictException,
} from "../domain/privacy.errors.js";
import { PrivacyPolicy } from "../domain/privacy.policy.js";
import { CONSENT_REPOSITORY } from "../ports/consent-repository.port.js";
import type { ConsentRepositoryPort } from "../ports/consent-repository.port.js";
import { toConsentVersionResponse } from "../dto/consent.response.js";
import type { CreateConsentDto } from "../dto/create-consent.dto.js";

@Injectable()
export class ConsentService {
  private readonly policy = new PrivacyPolicy();

  constructor(
    @Inject(CONSENT_REPOSITORY)
    private readonly consentRepo: ConsentRepositoryPort,
  ) {}

  async list(auth: AuthContext, options: ListConsentVersionsOptions) {
    if (!this.policy.canViewConsents(auth)) {
      throw new PrivacyForbiddenException();
    }

    const result = await this.consentRepo.list(options);
    return {
      items: result.items.map(toConsentVersionResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async create(auth: AuthContext, dto: CreateConsentDto) {
    if (!this.policy.canViewConsents(auth)) {
      throw new PrivacyForbiddenException();
    }

    const existing = await this.consentRepo.findByPurposeAndVersion(
      dto.purpose,
      dto.version,
    );
    if (existing) {
      throw new ConsentVersionConflictException(
        `同意版本 "${dto.purpose}" v${dto.version} 已存在`,
      );
    }

    const now = new Date();
    const consent: ConsentVersion = {
      id: randomUUID(),
      purpose: dto.purpose,
      version: dto.version,
      contentHash: dto.contentHash,
      contentUrl: dto.contentUrl ?? null,
      effectiveFrom: now,
      createdAt: now,
    };

    const saved = await this.consentRepo.save(consent);
    return toConsentVersionResponse(saved);
  }
}
