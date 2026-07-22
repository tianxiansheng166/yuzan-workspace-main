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
  readonly uri?: string | undefined;
  readonly mediaType: string;
  readonly byteSize: number;
  readonly altText?: string | undefined;
  readonly language?: string | undefined;
  readonly source?: string | undefined;
  readonly rightsStatus: RightsStatus;
  readonly rightsNote?: string | undefined;
}

export interface Activity {
  readonly id: string;
  readonly type: ActivityType;
  readonly title: string;
  readonly instruction?: BilingualContent | undefined;
  readonly sortOrder: number;
  readonly required: boolean;
  readonly completionRule?: unknown;
  readonly content?: unknown;
  readonly resources: readonly ResourceRef[];
  readonly teacherNotes?: BilingualContent | undefined;
  readonly studentNotes?: BilingualContent | undefined;
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
  readonly description?: string | undefined;
  readonly gradeBand?: string | undefined;
  readonly capabilityTheme?: string | undefined;
  readonly difficulty?: string | undefined;
  readonly locale: string;
  readonly dialect?: string | undefined;
  readonly objectives: readonly BilingualContent[];
  readonly coverAsset?: string | undefined;
  readonly taskGroups?: readonly string[] | undefined;
  readonly culturalElements?: readonly string[] | undefined;
  readonly estimatedMinutes?: number | undefined;
  readonly deviceRequirements?: unknown;
  readonly units: readonly Unit[];
  readonly submittedAt?: Date | undefined;
  readonly approvedAt?: Date | undefined;
  readonly publishedAt?: Date | undefined;
  readonly retiredAt?: Date | undefined;
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
