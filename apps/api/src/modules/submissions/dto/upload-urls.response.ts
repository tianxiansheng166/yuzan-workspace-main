export interface UploadUrlsResponse {
  readonly submissionId: string;
  readonly uploadUrl: string;
  readonly objectKey: string;
  readonly expiresInSeconds: number;
}
