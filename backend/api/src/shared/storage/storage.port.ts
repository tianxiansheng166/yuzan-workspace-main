export const STORAGE_PORT = Symbol("STORAGE_PORT");

export interface PresignedUrlResult {
  readonly url: string;
  readonly objectKey: string;
  readonly expiresInSeconds: number;
}

export interface HeadObjectResult {
  exists: boolean;
  contentLength?: number;
  contentType?: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
}

export interface StoragePort {
  /**
   * Server-side upload for trusted platform imports. Browser uploads continue
   * to use generateUploadUrl; this avoids duplicating storage configuration in
   * import commands while keeping the object-store boundary explicit.
   */
  putObject(
    objectKey: string,
    body: Uint8Array,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<void>;
  generateUploadUrl(objectKey: string, contentType?: string): Promise<PresignedUrlResult>;
  generateDownloadUrl(objectKey: string): Promise<PresignedUrlResult>;
  headObject(objectKey: string): Promise<HeadObjectResult>;
  deleteObject(objectKey: string): Promise<void>;
}
