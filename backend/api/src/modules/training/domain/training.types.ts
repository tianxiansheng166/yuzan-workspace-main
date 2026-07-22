export type TrainingProgramStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export const TRAINING_PROGRAM_STATUSES: readonly TrainingProgramStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
];

export type TrainingEnrollmentStatus =
  | "ENROLLED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export const TRAINING_ENROLLMENT_STATUSES: readonly TrainingEnrollmentStatus[] =
  ["ENROLLED", "IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED"];

export type TrainingExamStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "PASSED"
  | "FAILED";

export const TRAINING_EXAM_STATUSES: readonly TrainingExamStatus[] = [
  "SCHEDULED",
  "IN_PROGRESS",
  "PASSED",
  "FAILED",
];

export type MindGraphJobStatus =
  | "CREATED"
  | "QUEUED"
  | "RUNNING"
  | "READY"
  | "PROVIDER_UNAVAILABLE"
  | "FAILED"
  | "CANCELLED";

export const MIND_GRAPH_JOB_STATUSES: readonly MindGraphJobStatus[] = [
  "CREATED",
  "QUEUED",
  "RUNNING",
  "READY",
  "PROVIDER_UNAVAILABLE",
  "FAILED",
  "CANCELLED",
];

export interface TrainingModule {
  readonly id: string;
  readonly programId: string;
  readonly title: string;
  readonly description?: string;
  readonly sortOrder: number;
  readonly required: boolean;
  readonly durationMinutes?: number;
  readonly createdAt: Date;
}

export interface TrainingProgram {
  readonly id: string;
  readonly schoolId: string;
  readonly title: string;
  readonly description?: string;
  readonly objectives: readonly string[];
  readonly locale: string;
  readonly dialect?: string;
  readonly status: TrainingProgramStatus;
  readonly modules: readonly TrainingModule[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TrainingEnrollment {
  readonly id: string;
  readonly schoolId: string;
  readonly programId: string;
  readonly volunteerUserId: string;
  readonly status: TrainingEnrollmentStatus;
  readonly enrolledAt: Date;
  readonly completedAt?: Date;
  readonly examReady: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TrainingProgress {
  readonly id: string;
  readonly enrollmentId: string;
  readonly moduleId: string;
  readonly completed: boolean;
  readonly completedAt?: Date;
  readonly score?: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TrainingExam {
  readonly id: string;
  readonly schoolId: string;
  readonly programId: string;
  readonly enrollmentId: string;
  readonly scheduledAt: Date;
  readonly status: TrainingExamStatus;
  readonly passingScore: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TrainingExamAttempt {
  readonly id: string;
  readonly examId: string;
  readonly score: number;
  readonly passed: boolean;
  readonly submittedAt: Date;
  readonly createdAt: Date;
}
