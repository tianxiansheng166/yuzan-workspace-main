import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  HeadObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  type HeadObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StoragePort, PresignedUrlResult, HeadObjectResult } from "./storage.port.js";

@Injectable()
export class S3CompatibleStorageAdapter implements StoragePort {
  private readonly logger = new Logger(S3CompatibleStorageAdapter.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly defaultExpiresInSeconds = 3600;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.getOrThrow<string>("S3_ENDPOINT");
    const region = this.config.getOrThrow<string>("S3_REGION");
    this.bucket = this.config.getOrThrow<string>("S3_BUCKET");
    const accessKeyId = this.config.getOrThrow<string>("S3_ACCESS_KEY_ID");
    const secretAccessKey = this.config.getOrThrow<string>("S3_SECRET_ACCESS_KEY");
    const forcePathStyle = this.config.get<string>("S3_FORCE_PATH_STYLE") === "true";

    this.client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle,
      // MinIO's S3-compatible PutObject path does not implement the optional
      // flexible-checksum query parameters emitted by newer AWS SDK defaults.
      // Only calculate checksums where S3 requires them, so browser PUT URLs
      // remain compatible and errors are not masked as CORS failures.
      requestChecksumCalculation: "WHEN_REQUIRED",
    });

    this.logger.log(
      `S3 storage adapter initialized: endpoint=${endpoint}, bucket=${this.bucket}, forcePathStyle=${forcePathStyle}`,
    );
  }

  async generateUploadUrl(
    objectKey: string,
    contentType?: string,
  ): Promise<PresignedUrlResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ...(contentType ? { ContentType: contentType } : {}),
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: this.defaultExpiresInSeconds,
    });

    this.logger.debug(`Generated upload URL for ${objectKey}`);

    return {
      url,
      objectKey,
      expiresInSeconds: this.defaultExpiresInSeconds,
    };
  }

  async generateDownloadUrl(objectKey: string): Promise<PresignedUrlResult> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: this.defaultExpiresInSeconds,
    });

    this.logger.debug(`Generated download URL for ${objectKey}`);

    return {
      url,
      objectKey,
      expiresInSeconds: this.defaultExpiresInSeconds,
    };
  }

  async headObject(objectKey: string): Promise<HeadObjectResult> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      });
      const response: HeadObjectCommandOutput = await this.client.send(command);

      return {
        exists: true,
        ...(response.ContentLength !== undefined ? { contentLength: response.ContentLength } : {}),
        ...(response.ContentType ? { contentType: response.ContentType } : {}),
        ...(response.LastModified ? { lastModified: response.LastModified } : {}),
        ...(response.Metadata ? { metadata: response.Metadata as Record<string, string> } : {}),
      };
    } catch (error: unknown) {
      if (this.isNotFoundError(error)) {
        return { exists: false };
      }
      this.logger.error(`HeadObject failed for ${objectKey}: ${this.extractErrorMessage(error)}`);
      throw error;
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    });
    await this.client.send(command);
    this.logger.debug(`Deleted object ${objectKey}`);
  }

  private isNotFoundError(error: unknown): boolean {
    if (error && typeof error === "object") {
      if ("name" in error) {
        const name = (error as { name: string }).name;
        if (name === "NotFound" || name === "NoSuchKey") return true;
      }
      if ("$metadata" in error) {
        const meta = (error as { $metadata?: { httpStatusCode?: number } }).$metadata;
        if (meta?.httpStatusCode === 404) return true;
      }
    }
    return false;
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return String(error);
  }
}
