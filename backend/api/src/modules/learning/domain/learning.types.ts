export interface LearningTask {
  readonly assignmentId: string;
  readonly title: string;
  readonly status: string; // assignment status
  readonly dueAt: Date;
  readonly courseVersionId: string;
  readonly courseTitle: string;
}

export interface ActivityProgressRecord {
  readonly id: string;
  readonly schoolId: string;
  readonly activityId: string;
  readonly enrollmentId: string;
  readonly position: number;
  readonly completed: boolean;
  readonly revision: number;
  readonly updatedAt: Date;
}

export interface LearningActivityDetail {
  readonly activityId: string;
  readonly title: string;
  readonly type: string;
  readonly instruction?: string;
  readonly sortOrder: number;
  readonly required: boolean;
  readonly progress?: ActivityProgressRecord;
}

export interface UpdateProgressInput {
  readonly schoolId: string;
  readonly activityId: string;
  readonly enrollmentId: string;
  readonly position: number;
  readonly completed: boolean;
  readonly expectedRevision?: number;
}
