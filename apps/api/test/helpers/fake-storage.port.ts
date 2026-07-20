import type {
  HeadObjectResult,
  PresignedUrlResult,
  StoragePort,
} from "../../src/shared/storage/storage.port.js";

/**
 * In-memory fake StoragePort for unit tests.
 *
 * Returns deterministic presigned URLs and tracks calls so tests can assert
 * which object keys were generated. No real S3/MinIO interaction.
 */
export class FakeStoragePort implements StoragePort {
  readonly uploads: Array<{ objectKey: string; contentType?: string }> = [];
  readonly downloads: string[] = [];
  readonly deletes: string[] = [];
  private heads = new Map<string, HeadObjectResult>();

  async generateUploadUrl(
    objectKey: string,
    contentType?: string,
  ): Promise<PresignedUrlResult> {
    this.uploads.push({ objectKey, contentType });
    return {
      url: `https://test-bucket.local/upload/${encodeURIComponent(objectKey)}`,
      objectKey,
      expiresInSeconds: 300,
    };
  }

  async generateDownloadUrl(objectKey: string): Promise<PresignedUrlResult> {
    this.downloads.push(objectKey);
    return {
      url: `https://test-bucket.local/download/${encodeURIComponent(objectKey)}`,
      objectKey,
      expiresInSeconds: 300,
    };
  }

  async headObject(objectKey: string): Promise<HeadObjectResult> {
    return (
      this.heads.get(objectKey) ?? {
        exists: false,
      }
    );
  }

  async deleteObject(objectKey: string): Promise<void> {
    this.deletes.push(objectKey);
    this.heads.delete(objectKey);
  }

  /** Test helper: pretend an object exists in storage. */
  seed(objectKey: string, result: HeadObjectResult): this {
    this.heads.set(objectKey, result);
    return this;
  }
}