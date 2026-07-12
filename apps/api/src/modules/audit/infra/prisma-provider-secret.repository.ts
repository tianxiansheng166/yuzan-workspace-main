import { Injectable } from "@nestjs/common";
import type { Prisma } from "@yuzan/database";
import { PrismaService } from "../../../shared/database/prisma.service.js";
import { ProviderUnavailableException } from "../domain/provider.errors.js";
import type { SystemProviderSecret } from "../domain/provider.types.js";
import type { ProviderSecretRepositoryPort } from "../ports/provider-secret-repository.port.js";

@Injectable()
export class PrismaProviderSecretRepository
  implements ProviderSecretRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {}

  async findByProviderId(
    providerId: string,
  ): Promise<readonly SystemProviderSecret[]> {
    try {
      const rows = await this.prisma.systemProviderSecret.findMany({
        where: { providerId },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toSystemProviderSecret);
    } catch (err) {
      if (err instanceof ProviderUnavailableException) throw err;
      throw new ProviderUnavailableException();
    }
  }

  async save(secret: SystemProviderSecret): Promise<SystemProviderSecret> {
    try {
      const data: Prisma.SystemProviderSecretUncheckedCreateInput = {
        id: secret.id,
        providerId: secret.providerId,
        secretKey: secret.secretKey,
      };

      const existing = await this.prisma.systemProviderSecret.findUnique({
        where: { id: secret.id },
      });

      const row = existing
        ? await this.prisma.systemProviderSecret.update({
            where: { id: secret.id },
            data: data as Prisma.SystemProviderSecretUncheckedUpdateInput,
          })
        : await this.prisma.systemProviderSecret.create({ data });

      return toSystemProviderSecret(row);
    } catch (err) {
      if (err instanceof ProviderUnavailableException) throw err;
      throw new ProviderUnavailableException();
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.systemProviderSecret.delete({ where: { id } });
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

function toSystemProviderSecret(
  row: Prisma.SystemProviderSecretGetPayload<Record<string, never>>,
): SystemProviderSecret {
  return {
    id: row.id,
    providerId: row.providerId,
    secretKey: row.secretKey,
    createdAt: row.createdAt,
  };
}
