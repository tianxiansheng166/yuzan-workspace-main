export type AssignmentStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "OPEN"
  | "CLOSED"
  | "CANCELLED"
  | "ARCHIVED";

export interface Assignment {
  readonly id: string;
  readonly schoolId: string;
  readonly courseVersionId: string;
  readonly createdByUserId: string;
  readonly title: string;
  readonly status: AssignmentStatus;
  readonly startsAt: Date;
  readonly dueAt: Date;
  readonly offlineRequired: boolean;
  readonly completionRule?: unknown;
  readonly revision: number;
  readonly openedAt?: Date;
  readonly closedAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt?: Date;
  readonly targets: readonly AssignmentTarget[];
}

export interface AssignmentTarget {
  readonly id: string;
  readonly schoolId: string;
  readonly assignmentId: string;
  readonly targetType: "CLASS" | "STUDENT";
  readonly classId?: string;
  readonly enrollmentId?: string;
}

export interface AssignmentSummary {
  readonly id: string;
  readonly schoolId: string;
  readonly title: string;
  readonly status: AssignmentStatus;
  readonly startsAt: Date;
  readonly dueAt: Date;
  readonly revision: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly targets: readonly AssignmentTarget[];
}

export interface CreateAssignmentInput {
  readonly schoolId: string;
  readonly courseVersionId: string;
  readonly title: string;
  readonly startsAt: Date;
  readonly dueAt: Date;
  readonly offlineRequired?: boolean;
  readonly completionRule?: unknown;
  readonly targets: readonly {
    targetType: "CLASS" | "STUDENT";
    classId?: string;
    enrollmentId?: string;
  }[];
}

export interface UpdateAssignmentInput {
  readonly title?: string;
  readonly startsAt?: Date;
  readonly dueAt?: Date;
  readonly offlineRequired?: boolean;
  readonly completionRule?: unknown;
}
