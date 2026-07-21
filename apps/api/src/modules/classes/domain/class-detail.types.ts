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

/** Section VIII: Class dashboard aggregate */
export interface ClassDashboard {
  readonly classId: string;
  readonly className: string;
  readonly grade: string;
  readonly studentCount: number;
  readonly currentCourse: { readonly id: string; readonly title: string } | null;
  readonly completionRate: number;
  readonly submissionRate: number;
  readonly assessmentParticipationRate: number;
  readonly pendingReviewCount: number;
  readonly atRiskStudentCount: number;
  readonly lastActivityAt: string | null;
  readonly stages: readonly ClassGrowthStage[];
  readonly pronunciationClusters: readonly PronunciationClusterItem[];
}

/** Section V: Student summary for roster */
export interface StudentSummary {
  readonly enrollmentId: string;
  readonly userId: string;
  readonly displayName: string;
  readonly courseProgress: number;
  readonly submittedAssignmentCount: number;
  readonly missingAssignmentCount: number;
  readonly latestAssessmentStatus: string | null;
  readonly latestAssessmentScore: number | null;
  readonly recordingCount: number;
  readonly topIssue: string | null;
  readonly lastActiveAt: string | null;
  readonly riskStatus: 'OK' | 'AT_RISK' | 'INACTIVE';
}

/** Section VIII: Assignment summary */
export interface AssignmentSummary {
  readonly assignmentId: string;
  readonly title: string;
  readonly status: string;
  readonly dueAt: string | null;
  readonly submissionCount: number;
  readonly pendingReviewCount: number;
  readonly totalTargetCount: number;
  readonly courseTitle: string | null;
}

/** Section VIII: Assessment summary */
export interface AssessmentSummary {
  readonly sessionId: string;
  readonly title: string | null;
  readonly type: string;
  readonly status: string;
  readonly completedCount: number;
  readonly averageScore: number | null;
  readonly medianScore: number | null;
  readonly totalTargetCount: number;
  readonly createdAt: string;
}
