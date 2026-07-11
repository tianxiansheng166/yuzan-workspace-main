export enum ContentStatus {
  DRAFT = "DRAFT",
  PENDING_REVIEW = "PENDING_REVIEW",
  PUBLISHED = "PUBLISHED",
  HIDDEN = "HIDDEN",
  REJECTED = "REJECTED",
}

export enum ContentType {
  TEXT = "TEXT",
  AUDIO = "AUDIO",
  VIDEO = "VIDEO",
  IMAGE = "IMAGE",
}

export enum ReportReason {
  INAPPROPRIATE = "INAPPROPRIATE",
  OFFENSIVE = "OFFENSIVE",
  PRIVACY_VIOLATION = "PRIVACY_VIOLATION",
  MISINFORMATION = "MISINFORMATION",
  OTHER = "OTHER",
}

export enum ReportStatus {
  PENDING = "PENDING",
  REVIEWED = "REVIEWED",
  DISMISSED = "DISMISSED",
}

export interface CommunityPost {
  readonly id: string;
  readonly schoolId: string;
  readonly authorUserId: string;
  readonly title: string;
  readonly contentType: ContentType;
  readonly content: string;
  readonly attachmentObjectKey?: string;
  readonly status: ContentStatus;
  readonly publishedAt?: Date;
  readonly reviewedBy?: string;
  readonly reviewedAt?: Date;
  readonly reviewNote?: string;
  readonly visibilityScope: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly revision: number;
}

export interface PostComment {
  readonly id: string;
  readonly postId: string;
  readonly authorUserId: string;
  readonly content: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ContentReport {
  readonly id: string;
  readonly schoolId: string;
  readonly postId: string;
  readonly reporterUserId: string;
  readonly reason: ReportReason;
  readonly description?: string;
  readonly status: ReportStatus;
  readonly reviewedBy?: string;
  readonly reviewedAt?: Date;
  readonly createdAt: Date;
}
