export interface ClassDetail {
  readonly classId: string;
  readonly className: string;
  readonly grade: string;
  readonly termName: string;
  readonly studentCount: number;
  readonly currentCourse: { readonly id: string; readonly title: string } | null;
  readonly overallProgress: number;
  readonly pendingReviewCount: number;
  readonly stages: readonly ClassGrowthStage[];
  readonly pronunciationClusters: readonly PronunciationClusterItem[];
}

export interface ClassGrowthStage {
  readonly id: string;
  readonly title: string;
  readonly completionRate: number;
  readonly participantCount: number;
  readonly totalCount: number;
}

export interface PronunciationClusterItem {
  readonly type: string;
  readonly label: string;
  readonly affectedCount: number;
  readonly percentage: number;
}

export interface ClassPendingStats {
  readonly pendingReviewCount: number;
  readonly unsubmittedAssignmentsCount: number;
  readonly atRiskStudentCount: number;
  readonly pendingAssessmentsCount: number;
}
