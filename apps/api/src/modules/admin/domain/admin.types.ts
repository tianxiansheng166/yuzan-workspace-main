export interface ProviderStatus {
  readonly type: string;
  readonly healthStatus: string;
  readonly lastCheckedAt: Date;
}

export interface PlatformMetrics {
  readonly schoolCount: number;
  readonly activeUserCount: number;
  readonly publishedCourseCount: number;
  readonly pendingReviewCount: number;
  readonly assessmentTaskCount: number;
  readonly learningCompletionRate: number;
  readonly systemErrorCount: number;
  readonly providerStatuses: readonly ProviderStatus[];
}

export interface AdminSchool {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly timezone: string;
  readonly regionCode: string | null;
  readonly isActive: boolean;
  readonly planId: string | null;
  readonly planTier: string | null;
  readonly membershipCount: number;
  readonly classCount: number;
  readonly courseCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface SchoolUsageStats {
  readonly membershipCount: number;
  readonly classCount: number;
  readonly courseCount: number;
  readonly assignmentCount: number;
  readonly submissionCount: number;
}

export interface AdminUser {
  readonly id: string;
  readonly loginIdentifier: string;
  readonly displayName: string;
  readonly preferredLocale: string;
  readonly status: string;
  readonly memberships: readonly AdminMembership[];
  readonly lastActiveAt: Date | null;
  readonly createdAt: Date;
}

export interface AdminMembership {
  readonly id: string;
  readonly schoolId: string;
  readonly schoolName: string;
  readonly role: string;
  readonly status: string;
  readonly joinedAt: Date;
}

export interface BulkImportResultItem {
  readonly loginIdentifier: string;
  readonly success: boolean;
  readonly error?: string;
}

export type BulkImportResult = readonly BulkImportResultItem[];
