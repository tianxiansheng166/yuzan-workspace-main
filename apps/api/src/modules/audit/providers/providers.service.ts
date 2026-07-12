import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AuthContext } from "../../../common/security/auth.types.js";
import type {
  ProviderType,
  SystemProvider,
  SystemProviderSecret,
} from "../domain/provider.types.js";
import {
  ProviderConflictException,
  ProviderNotFoundException,
  ProviderUnavailableException,
} from "../domain/provider.errors.js";
import { ProviderPolicy } from "../domain/provider.policy.js";
import { PROVIDER_REPOSITORY } from "../ports/provider-repository.port.js";
import type { ProviderRepositoryPort } from "../ports/provider-repository.port.js";
import { PROVIDER_SECRET_REPOSITORY } from "../ports/provider-secret-repository.port.js";
import type { ProviderSecretRepositoryPort } from "../ports/provider-secret-repository.port.js";
import {
  toProviderResponse,
  type ProviderResponse,
} from "../dto/provider.response.js";
import {
  toProviderHealthResponse,
  type ProviderHealthResponse,
} from "../dto/provider-health.response.js";
import type { CreateProviderDto } from "../dto/create-provider.dto.js";
import type { UpdateProviderDto } from "../dto/update-provider.dto.js";

@Injectable()
export class ProvidersService {
  private readonly policy = new ProviderPolicy();

  constructor(
    @Inject(PROVIDER_REPOSITORY)
    private readonly providerRepo: ProviderRepositoryPort,
    @Inject(PROVIDER_SECRET_REPOSITORY)
    private readonly secretRepo: ProviderSecretRepositoryPort,
  ) {}

  async list(
    auth: AuthContext,
    type?: ProviderType,
    enabled?: boolean,
  ): Promise<readonly ProviderResponse[]> {
    if (!this.policy.canViewProviders(auth)) {
      throw new ProviderNotFoundException();
    }

    const providers = await this.providerRepo.list(type, enabled);
    return providers.map(toProviderResponse);
  }

  async findById(auth: AuthContext, id: string): Promise<ProviderResponse> {
    if (!this.policy.canViewProviders(auth)) {
      throw new ProviderNotFoundException();
    }

    const provider = await this.providerRepo.findById(id);
    if (!provider) {
      throw new ProviderNotFoundException();
    }

    return toProviderResponse(provider);
  }

  async create(
    auth: AuthContext,
    dto: CreateProviderDto,
  ): Promise<ProviderResponse> {
    if (!this.policy.canManageProviders(auth)) {
      throw new ProviderConflictException();
    }

    const now = new Date();
    const providerId = randomUUID();

    const provider: SystemProvider = {
      id: providerId,
      type: dto.type,
      enabled: dto.enabled ?? true,
      endpointAlias: dto.endpointAlias ?? null,
      model: dto.model ?? null,
      healthStatus: "UNKNOWN",
      configured: !!dto.secretKey,
      lastCheckedAt: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.providerRepo.save(provider);

    if (dto.secretKey) {
      const secret: SystemProviderSecret = {
        id: randomUUID(),
        providerId: saved.id,
        secretKey: dto.secretKey,
        createdAt: now,
      };
      await this.secretRepo.save(secret);
    }

    return toProviderResponse(saved);
  }

  async update(
    auth: AuthContext,
    id: string,
    dto: UpdateProviderDto,
  ): Promise<ProviderResponse> {
    if (!this.policy.canManageProviders(auth)) {
      throw new ProviderConflictException();
    }

    const existing = await this.providerRepo.findById(id);
    if (!existing) {
      throw new ProviderNotFoundException();
    }

    const expectedUpdatedAt = new Date(dto.expectedUpdatedAt);
    if (existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
      throw new ProviderConflictException(
        "Provider 已被其他操作修改，请刷新后重试",
      );
    }

    const updated: SystemProvider = {
      ...existing,
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      ...(dto.endpointAlias !== undefined
        ? { endpointAlias: dto.endpointAlias }
        : {}),
      ...(dto.model !== undefined ? { model: dto.model } : {}),
      updatedAt: new Date(),
    };

    const saved = await this.providerRepo.save(updated);

    if (dto.secretKey !== undefined) {
      const now = new Date();
      const secret: SystemProviderSecret = {
        id: randomUUID(),
        providerId: saved.id,
        secretKey: dto.secretKey,
        createdAt: now,
      };
      await this.secretRepo.save(secret);
    }

    return toProviderResponse(saved);
  }

  async delete(
    auth: AuthContext,
    id: string,
  ): Promise<{ deleted: boolean }> {
    if (!this.policy.canManageProviders(auth)) {
      throw new ProviderConflictException();
    }

    const deleted = await this.providerRepo.delete(id);
    if (!deleted) {
      throw new ProviderNotFoundException();
    }

    return { deleted: true };
  }

  async checkHealth(
    auth: AuthContext,
    id: string,
  ): Promise<ProviderHealthResponse> {
    if (!this.policy.canCheckHealth(auth)) {
      throw new ProviderConflictException();
    }

    const existing = await this.providerRepo.findById(id);
    if (!existing) {
      throw new ProviderNotFoundException();
    }

    const now = new Date();
    const updated: SystemProvider = {
      ...existing,
      lastCheckedAt: now,
      updatedAt: now,
    };

    const saved = await this.providerRepo.save(updated);
    return toProviderHealthResponse(saved);
  }

  async getHealthStatus(
    auth: AuthContext,
    id: string,
  ): Promise<ProviderHealthResponse> {
    if (!this.policy.canCheckHealth(auth)) {
      throw new ProviderConflictException();
    }

    const existing = await this.providerRepo.findById(id);
    if (!existing) {
      throw new ProviderNotFoundException();
    }

    return toProviderHealthResponse(existing);
  }

  async listProviders(auth: AuthContext): Promise<readonly ProviderResponse[]> {
    return this.catchUnavailable(() => this.list(auth));
  }

  async createProvider(
    auth: AuthContext,
    type: ProviderType,
    enabled: boolean,
    endpointAlias?: string,
    model?: string,
    secretKey?: string,
  ): Promise<ProviderResponse> {
    const dto: CreateProviderDto = {
      type,
      enabled,
      ...(endpointAlias !== undefined ? { endpointAlias } : {}),
      ...(model !== undefined ? { model } : {}),
      ...(secretKey !== undefined ? { secretKey } : {}),
    };
    return this.catchUnavailable(() => this.create(auth, dto));
  }

  async updateProvider(
    auth: AuthContext,
    id: string,
    dto: Omit<UpdateProviderDto, "type" | "endpointAlias" | "model" | "secretKey"> &
      Partial<Pick<UpdateProviderDto, "type" | "endpointAlias" | "model" | "secretKey">>,
  ): Promise<ProviderResponse> {
    return this.catchUnavailable(() => this.update(auth, id, dto as UpdateProviderDto));
  }

  private async catchUnavailable<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof ProviderUnavailableException) {
        throw new ProviderNotFoundException();
      }
      throw err;
    }
  }
}
