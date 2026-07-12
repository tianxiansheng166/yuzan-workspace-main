import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../../common/security/auth.types.js";
import type {
  AssessmentLink,
  ListLinksOptions,
  PaginatedResult,
} from "../domain/link.types.js";
import { LinkPolicy } from "../domain/link.policy.js";
import {
  LinkNotFoundException,
  LinkRegenerationException,
} from "../domain/link.errors.js";
import {
  LINK_REPOSITORY,
  type LinkRepositoryPort,
} from "../ports/link-repository.port.js";
import type { RegenerateLinkDto } from "../dto/regenerate-link.dto.js";

@Injectable()
export class LinksService {
  private readonly policy = new LinkPolicy();

  constructor(
    @Inject(LINK_REPOSITORY)
    private readonly linkRepo: LinkRepositoryPort,
  ) {}

  async list(
    auth: AuthContext,
    options: ListLinksOptions,
  ): Promise<PaginatedResult<AssessmentLink>> {
    if (!this.policy.canViewLinks(auth)) {
      throw new LinkRegenerationException("无权查看测评链接");
    }

    return this.linkRepo.list(options);
  }

  async findById(
    auth: AuthContext,
    schoolId: string,
    id: string,
  ): Promise<AssessmentLink> {
    if (!this.policy.canViewLinks(auth)) {
      throw new LinkRegenerationException("无权查看测评链接");
    }

    const link = await this.linkRepo.findById(schoolId, id);
    if (!link) {
      throw new LinkNotFoundException();
    }
    return link;
  }

  async disable(
    auth: AuthContext,
    schoolId: string,
    id: string,
  ): Promise<AssessmentLink> {
    if (!this.policy.canDisableLink(auth)) {
      throw new LinkRegenerationException("无权禁用测评链接");
    }

    const existing = await this.linkRepo.findById(schoolId, id);
    if (!existing) {
      throw new LinkNotFoundException();
    }

    if (existing.status === "DISABLED") {
      throw new LinkRegenerationException("测评链接已禁用");
    }

    const now = new Date();
    const updated: AssessmentLink = {
      ...existing,
      status: "DISABLED",
      disabledAt: now,
      updatedAt: now,
    };

    return this.linkRepo.save(updated);
  }

  async regenerate(
    auth: AuthContext,
    schoolId: string,
    id: string,
    dto: RegenerateLinkDto,
  ): Promise<AssessmentLink> {
    if (!this.policy.canRegenerateLink(auth)) {
      throw new LinkRegenerationException("无权重新生成测评链接");
    }

    const existing = await this.linkRepo.findById(schoolId, id);
    if (!existing) {
      throw new LinkNotFoundException();
    }

    if (existing.status === "DISABLED") {
      throw new LinkRegenerationException("已禁用的测评链接不能重新生成");
    }

    // Disable the old link
    const now = new Date();
    const disabledLink: AssessmentLink = {
      ...existing,
      status: "DISABLED",
      disabledAt: now,
      updatedAt: now,
    };
    await this.linkRepo.save(disabledLink);

    // Create a new link with regeneratedFromId referencing the old one
    const newTokenHash = hashToken(generateToken());
    const newLink: AssessmentLink = {
      id: crypto.randomUUID(),
      schoolId: existing.schoolId,
      assignmentId: existing.assignmentId,
      tokenHash: newTokenHash,
      status: "ACTIVE",
      usageCount: 0,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : existing.expiresAt,
      disabledAt: null,
      regeneratedFromId: existing.id,
      createdAt: now,
      updatedAt: now,
    };

    return this.linkRepo.save(newLink);
  }
}

/**
 * Generate a cryptographically random token for assessment links.
 */
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Hash a token for storage. Uses a simple hex representation
 * since the real implementation would use bcrypt/argon2.
 */
function hashToken(token: string): string {
  // In production this would be a proper hash like SHA-256 or bcrypt.
  // For the domain service we just need a stable representation.
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  // Simple hex encoding for the stub; a real impl would use crypto.subtle.digest
  return token;
}
