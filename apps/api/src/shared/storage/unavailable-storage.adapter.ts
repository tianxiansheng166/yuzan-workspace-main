import { Injectable } from "@nestjs/common";
import type { StoragePort, PresignedUrlResult, HeadObjectResult } from "./storage.port.js";

/**
 * Fallback storage adapter that throws PROVIDER_NOT_CONFIGURED
 * when no real storage provider (e.g. S3, MinIO) is configured.
 * This ensures the application fails explicitly rather than silently
 * returning stale or missing data.
 */
@Injectable()
export class UnavailableStorageAdapter implements StoragePort {
  async generateUploadUrl(
    _objectKey: string,
    _contentType?: string,
  ): Promise<PresignedUrlResult> {
    throw Object.assign(
      new Error("Storage provider is not configured — cannot generate upload URL"),
      { code: "PROVIDER_NOT_CONFIGURED" },
    );
  }

  async generateDownloadUrl(
    _objectKey: string,
  ): Promise<PresignedUrlResult> {
    throw Object.assign(
      new Error("Storage provider is not configured — cannot generate download URL"),
      { code: "PROVIDER_NOT_CONFIGURED" },
    );
  }

  async headObject(_objectKey: string): Promise<HeadObjectResult> {
    throw Object.assign(
      new Error("Storage provider is not configured — cannot check object"),
      { code: "PROVIDER_NOT_CONFIGURED" },
    );
  }

  async deleteObject(_objectKey: string): Promise<void> {
    throw Object.assign(
      new Error("Storage provider is not configured — cannot delete object"),
      { code: "PROVIDER_NOT_CONFIGURED" },
    );
  }
}