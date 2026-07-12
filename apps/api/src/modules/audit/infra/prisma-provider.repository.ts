import { Injectable } from "@nestjs/common";
import type { Prisma } from "@yuzan/database";
import { PrismaService } from "../../../shared/database/prisma.service.js";
import { ProviderUnavailableException } from "../domain/provider.errors.js";
import type {
  ProviderType,
  SystemProvider,
} from "../domain/provider.types.js";
import type { ProviderRepositoryPort } from "../ports/provider-repository.port.js";

@Injectable()
export class PrismaProviderRepository implements ProviderRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<SystemProvider | null> {
    try {
      const row = await this.prisma.systemProvider.findUnique({ where: { id } });
      return row ? toSystemProvider(row) : null;
    } catch (err) {
      if (err instanceof ProviderUnavailableException) throw err;
      throw new ProviderUnavailableException();
    }
  }

  async list(
    type?: ProviderType,
    enabled?: boolean,
  ): Promise<readonly SystemProvider[]> {
    try {
      const where: Prisma.SystemProviderWhereInput = {};
      if (type) {
        where.type = type as NonNullable<Prisma.SystemProviderWhereInput["type"]>;
      }
      if (enabled !== undefined) {
        where.enabled = enabled;
      }

      const rows = await this.prisma.systemProvider.findMany({
        where,
        orderBy: { type: "asc" },
      });
      return rows.map(toSystemProvider);
    } catch (err) {
      if (err instanceof ProviderUnavailableException) throw err;
      throw new ProviderUnavailableException();
    }
  }

  async save(provider: SystemProvider): Promise<SystemProvider> {
    try {
      const data: Prisma.SystemProviderUncheckedCreateInput = {
        id: provider.id,
        type: provider.type as Prisma.SystemProviderUncheckedCreateInput["type"],
        enabled: provider.enabled,
        endpointAlias: provider.endpointAlias ?? null,
        model: provider.model ?? null,
        healthStatus: provider.healthStatus as NonNullable<Prisma.SystemProviderUncheckedCreateInput["healthStatus"]>,
        configured: provider.configured,
        lastCheckedAt: provider.lastCheckedAt ?? null,
        lastError: provider.lastError ?? null,
      };

      const existing = await this.prisma.systemProvider.findUnique({
        where: { id: provider.id },
      });

      const row = existing
        ? await this.prisma.systemProvider.update({
            where: { id: provider.id },
            data: data as Prisma.SystemProviderUncheckedUpdateInput,
          })
        : await this.prisma.systemProvider.create({ data });

      return toSystemProvider(row);
    } catch (err) {
      if (err instanceof ProviderUnavailableException) throw err;
      throw new ProviderUnavailableException();
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.systemProvider.delete({ where: { id } });
      return true;
    } catch (err) {
      if (err instanceof ProviderUnavailableException) throw err;
      if (
        err instanceof Error &&
        "code" in err &&
        err.code === "P2025"
      ) {
        return false;
      }
      throw new ProviderUnavailableException();
    }
  }
}

function toSystemProvider(
  row: Prisma.SystemProviderGetPayload<Record<string, never>>,
): SystemProvider {
  return {
    id: row.id,
    type: row.type as ProviderType,
    enabled: row.enabled,
    endpointAlias: row.endpointAlias ?? null,
    model: row.model ?? null,
    healthStatus: row.healthStatus as SystemProvider["healthStatus"],
    configured: row.configured,
    lastCheckedAt: row.lastCheckedAt ?? null,
    lastError: row.lastError ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
