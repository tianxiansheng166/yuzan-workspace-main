export interface AtRiskStudent {
  readonly enrollmentId: string;
  readonly studentName: string;
  readonly className: string;
  readonly issue: string;
  readonly trend: string;
  readonly riskScore: number;
  readonly lastActiveAt: Date | null;
}

export interface PronunciationCluster {
  readonly label: string;
  readonly count: number;
  readonly percentage: number;
}

export interface DashboardGreeting {
  name: string;
  date: string;
  priorityCount?: number;
}

export interface DashboardPriority {
  readonly title: string;
  readonly detail: string;
  readonly count: number;
}

export interface DashboardWorkflowItem {
  readonly id: string;
  readonly tone: string;
  readonly icon: string;
  readonly count: number;
  readonly title: string;
  readonly subtitle: string;
}

export interface DashboardCourse {
  readonly id: string;
  readonly title: string;
  readonly tags: readonly string[];
  readonly updatedAt: string;
}

export interface DashboardTask {
  readonly id: string;
  readonly title: string;
  readonly dueAt: string;
  readonly done: number;
  readonly total: number;
  readonly tone: string;
}

export interface DashboardReview {
  readonly submissionId: string;
  readonly studentName: string;
  readonly taskTitle: string;
  readonly submittedAt: string;
}

export interface DashboardStudent {
  readonly enrollmentId: string;
  readonly name: string;
  readonly issue: string;
  readonly trend: string;
}
