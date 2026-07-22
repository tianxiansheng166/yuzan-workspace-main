export type ResourceKind =
  "IMAGE" | "AUDIO" | "VIDEO" | "DOCUMENT" | "SUBTITLE" | "OTHER";

export type RightsStatus = "UNKNOWN" | "RESTRICTED" | "APPROVED" | "REJECTED";

export interface Resource {
  readonly id: string;
  readonly schoolId: string | null;
  readonly kind: ResourceKind;
  readonly objectKey: string;
  readonly originalName: string;
  readonly mediaType: string;
  readonly byteSize: number;
  readonly checksumSha256: string;
  readonly rightsStatus: RightsStatus;
  readonly rightsNote?: string;
  readonly offlineAllowed: boolean;
}
