import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AuthContext } from "../../common/security/auth.types.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { STORAGE_PORT, type StoragePort } from "../../shared/storage/storage.port.js";
import type { Resource } from "./domain/resource.types.js";
import { PresignUploadDto } from "./dto/presign-upload.dto.js";
import { ConfirmUploadDto } from "./dto/confirm-upload.dto.js";
import type { ResourceLookupPort } from "./ports/resource-lookup.port.js";

@Injectable()
export class ResourcesService implements ResourceLookupPort {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  async presignUpload(
    auth: AuthContext,
    schoolId: string,
    dto: PresignUploadDto,
  ): Promise<{ resourceId: string; uploadUrl: string; objectKey: string; expiresInSeconds: number }> {
    this.assertSchoolAccess(auth, schoolId);
    const fileName = dto.fileName.replace(/[\\/]/g, "_");
    if (!fileName || fileName === "." || fileName === "..") throw new BadRequestException("Invalid file name");
    const objectKey = `schools/${schoolId}/resources/${dto.kind.toLowerCase()}/${randomUUID()}/${fileName}`;
    const result = await this.storage.generateUploadUrl(objectKey, dto.contentType);

    const resource = await this.prisma.resource.create({
      data: {
        schoolId,
        kind: dto.kind as "IMAGE" | "AUDIO" | "VIDEO" | "DOCUMENT" | "SUBTITLE" | "OTHER",
        objectKey,
        originalName: fileName,
        mediaType: dto.contentType ?? "application/octet-stream",
        byteSize: dto.byteSize ?? 0,
        checksumSha256: "",
        rightsStatus: "UNKNOWN",
        offlineAllowed: false,
      },
    });

    return {
      resourceId: resource.id,
      uploadUrl: result.url,
      objectKey: result.objectKey,
      expiresInSeconds: result.expiresInSeconds,
    };
  }

  async confirmUpload(
    auth: AuthContext,
    schoolId: string,
    resourceId: string,
    dto: ConfirmUploadDto,
  ): Promise<{ id: string; objectKey: string }> {
    this.assertSchoolAccess(auth, schoolId);
    const resource = await this.prisma.resource.findUnique({ where: { id: resourceId } });
    if (!resource || resource.schoolId !== schoolId) {
      throw new NotFoundException("Resource not found");
    }
    if (dto.objectKey !== resource.objectKey) throw new BadRequestException("Object key does not match the pending resource");

    const head = await this.storage.headObject(resource.objectKey);
    if (!head.exists) {
      throw new NotFoundException("Uploaded file not found in storage");
    }

    const updated = await this.prisma.resource.update({
      where: { id: resourceId },
      data: {
        byteSize: head.contentLength ?? resource.byteSize,
        mediaType: head.contentType ?? resource.mediaType,
        checksumSha256: dto.checksumSha256 ?? resource.checksumSha256,
      },
    });

    return { id: updated.id, objectKey: updated.objectKey };
  }

  async getPlaybackUrl(
    auth: AuthContext,
    schoolId: string,
    resourceId: string,
  ): Promise<{ url: string; expiresInSeconds: number; mediaType: string }> {
    this.assertSchoolAccess(auth, schoolId);
    const resource = await this.prisma.resource.findUnique({ where: { id: resourceId, deletedAt: null } });
    if (!resource || (resource.schoolId !== schoolId && resource.schoolId !== null)) {
      throw new NotFoundException("Resource not found");
    }

    const result = await this.storage.generateDownloadUrl(resource.objectKey);
    return {
      url: result.url,
      expiresInSeconds: result.expiresInSeconds,
      mediaType: resource.mediaType,
    };
  }

  async getResourceInfo(
    auth: AuthContext,
    schoolId: string,
    resourceId: string,
  ): Promise<{ id: string; kind: string; objectKey: string; originalName: string; mediaType: string; byteSize: number; rightsStatus: string }> {
    this.assertSchoolAccess(auth, schoolId);
    const resource = await this.prisma.resource.findUnique({ where: { id: resourceId, deletedAt: null } });
    if (!resource || (resource.schoolId !== schoolId && resource.schoolId !== null)) {
      throw new NotFoundException("Resource not found");
    }
    return {
      id: resource.id,
      kind: resource.kind,
      objectKey: resource.objectKey,
      originalName: resource.originalName,
      mediaType: resource.mediaType,
      byteSize: Number(resource.byteSize),
      rightsStatus: resource.rightsStatus,
    };
  }

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

  private assertSchoolAccess(auth: AuthContext, schoolId: string) {
    if (auth.tenant.schoolId !== schoolId) throw new ForbiddenException("No access to this school resource");
  }
}
