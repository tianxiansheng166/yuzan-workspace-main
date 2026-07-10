import type {
  ResourceKind,
  RightsStatus,
} from "../../resources/domain/resource.types.js";

export type CourseVersionStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "PUBLISHED"
  | "RETIRED";

export const COURSE_VERSION_STATUSES: readonly CourseVersionStatus[] = [
  "DRAFT",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "PUBLISHED",
  "RETIRED",
];

export type ActivityType =
  "TEXT" | "VIDEO" | "AUDIO" | "CHOICE" | "FILL_BLANK" | "SPEECH";

export type TranslationSource = "NONE" | "AUTO" | "EXPERT" | "COMMUNITY";

export type TranslationReviewStatus =
  "PENDING" | "REVIEWED" | "EXPERT_CONFIRMED";

export interface BilingualContent {
  readonly originalText: string;
  readonly translation?: string;
  readonly locale: string;
  readonly translationSource: TranslationSource;
  readonly reviewStatus: TranslationReviewStatus;
}

export interface ResourceRef {
  readonly id: string;
  readonly kind: ResourceKind;
  readonly objectKey: string;
  readonly uri?: string;
  readonly mediaType: string;
  readonly byteSize: number;
  readonly altText?: string;
  readonly language?: string;
  readonly source?: string;
  readonly rightsStatus: RightsStatus;
  readonly rightsNote?: string;
}

export interface Activity {
  readonly id: string;
  readonly type: ActivityType;
  readonly title: string;
  readonly instruction?: BilingualContent;
  readonly sortOrder: number;
  readonly required: boolean;
  readonly completionRule?: unknown;
  readonly content?: unknown;
  readonly resources: readonly ResourceRef[];
  readonly teacherNotes?: BilingualContent;
  readonly studentNotes?: BilingualContent;
}

export interface Lesson {
  readonly id: string;
  readonly title: string;
  readonly sortOrder: number;
  readonly activities: readonly Activity[];
}

export interface Unit {
  readonly id: string;
  readonly title: string;
  readonly sortOrder: number;
  readonly lessons: readonly Lesson[];
}

export interface CourseVersion {
  readonly id: string;
  readonly schoolId: string;
  readonly courseId: string;
  readonly authorUserId: string;
  readonly version: number;
  readonly status: CourseVersionStatus;
  readonly title: string;
  readonly description?: string;
  readonly gradeBand?: string;
  readonly locale: string;
  readonly dialect?: string;
  readonly objectives: readonly BilingualContent[];
  readonly units: readonly Unit[];
  readonly submittedAt?: Date;
  readonly approvedAt?: Date;
  readonly publishedAt?: Date;
  readonly retiredAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CourseVersionSummary {
  readonly id: string;
  readonly courseId: string;
  readonly version: number;
  readonly title: string;
  readonly status: CourseVersionStatus;
  readonly gradeBand: string | null;
  readonly updatedAt: Date;
}

export function toSummary(version: CourseVersion): CourseVersionSummary {
  return {
    id: version.id,
    courseId: version.courseId,
    version: version.version,
    title: version.title,
    status: version.status,
    gradeBand: version.gradeBand ?? null,
    updatedAt: version.updatedAt,
  };
}
