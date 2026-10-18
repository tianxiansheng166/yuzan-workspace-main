export interface ClassStudentDetailResponse {
  readonly schoolId: string;
  readonly classId: string;
  readonly enrollment: {
    readonly id: string;
    readonly userId: string;
    readonly displayName: string;
    readonly classId: string;
    readonly className: string;
    readonly grade: string;
    readonly role: "STUDENT";
    readonly status: "ACTIVE";
    readonly joinedAt: string;
  };
  readonly learning: {
    readonly totalActivities: number;
    readonly completedActivities: number;
    readonly completionRate: number | null;
    readonly lastActivityAt: string | null;
  };
  readonly assignments: readonly {
    readonly assignmentId: string;
    readonly title: string;
    readonly courseTitle: string | null;
    readonly status: string;
    readonly dueAt: string;
    readonly createdAt: string;
    readonly submissionStatus: string | null;
    readonly submissionId: string | null;
    readonly submittedAt: string | null;
    readonly feedback: {
      readonly decision: string;
      readonly comment: string;
      readonly score: number | null;
      readonly releasedAt: string;
    } | null;
  }[];
  readonly assessments: readonly {
    readonly sessionId: string;
    readonly practiceDefinitionId: string | null;
    readonly title: string | null;
    readonly type: string;
    readonly status: string;
    readonly createdAt: string;
    readonly completedAt: string | null;
    readonly overallScore: number | null;
    readonly reportGeneratedAt: string | null;
  }[];
  readonly recordings: readonly {
    readonly recordingId: string;
    readonly status: string;
    readonly durationMs: number | null;
    readonly createdAt: string;
    readonly assignmentId: string | null;
    readonly assignmentTitle: string | null;
  }[];
}
