export interface CourseDashboardItem {
  readonly courseVersionId: string;
  readonly courseTitle: string;
  readonly gradeBand: string | null;
  readonly progressPercent: number;
  readonly latestFeedbackAt: string | null;
  readonly hasOfflinePackage: boolean;
}

export interface TodayTask {
  readonly assignmentId: string;
  readonly title: string;
  readonly courseTitle: string;
  readonly dueAt: string;
  readonly status: string;
  readonly progressPercent: number;
  readonly hasOfflinePackage: boolean;
}

export interface TeacherAdviceItem {
  readonly feedbackId: string;
  readonly comment: string;
  readonly decision: string;
  readonly score: number | null;
  readonly courseTitle: string;
  readonly assignmentTitle: string;
  readonly releasedAt: string;
}

export interface RecommendationItem {
  readonly courseVersionId: string;
  readonly courseTitle: string;
  readonly reason: string;
}

export interface StudentProfileData {
  readonly userId: string;
  readonly displayName: string;
  readonly schoolName: string;
  readonly gradeBand: string | null;
  readonly className: string | null;
  readonly totalActivities: number;
  readonly completedActivities: number;
  readonly learningStreakDays: number;
  readonly offlinePackageCount: number;
}

export interface CoursesDashboardResponse {
  readonly courses: readonly CourseDashboardItem[];
}

export interface TodayTasksResponse {
  readonly date: string;
  readonly tasks: readonly TodayTask[];
}

export interface TeacherAdviceResponse {
  readonly items: readonly TeacherAdviceItem[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface RecommendationsResponse {
  readonly items: readonly RecommendationItem[];
}

export interface StudentProfileResponse {
  readonly profile: StudentProfileData;
}
