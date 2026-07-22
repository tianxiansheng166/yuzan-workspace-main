import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../shared/database/prisma.service.js";
import type { Resource } from "../domain/resource.types.js";
import type { ResourceLookupPort } from "./resource-lookup.port.js";

@Injectable()
export class PrismaResourceLookupAdapter implements ResourceLookupPort {
  constructor(private readonly prisma: PrismaService) {}

  async exists(schoolId: string | null, resourceId: string): Promise<boolean> {
    const resource = await this.prisma.resource.findFirst({
      where: {
        id: resourceId,
        deletedAt: null,
        ...(schoolId === null ? { schoolId: null } : { OR: [{ schoolId }, { schoolId: null }] }),
      },
      select: { id: true },
    });
    return resource !== null;
  }

  async findByIds(ids: readonly string[]): Promise<readonly Resource[]> {
    if (ids.length === 0) return [];
    const resources = await this.prisma.resource.findMany({ where: { id: { in: [...ids] }, deletedAt: null } });
    return resources.map((resource) => ({
      id: resource.id,
      schoolId: resource.schoolId,
      kind: resource.kind as Resource["kind"],
      objectKey: resource.objectKey,
      originalName: resource.originalName,
      mediaType: resource.mediaType,
      byteSize: Number(resource.byteSize),
      checksumSha256: resource.checksumSha256,
      rightsStatus: resource.rightsStatus as Resource["rightsStatus"],
      ...(resource.rightsNote ? { rightsNote: resource.rightsNote } : {}),
      offlineAllowed: resource.offlineAllowed,
    }));
  }
}
