import type {
  TrainingEnrollment,
  TrainingExam,
  TrainingExamAttempt,
  TrainingModule,
  TrainingProgram,
  TrainingProgress,
} from "../domain/training.types.js";

// --- TrainingModule ---

export interface TrainingModuleResponse {
  readonly id: string;
  readonly programId: string;
  readonly title: string;
  readonly description?: string;
  readonly sortOrder: number;
  readonly required: boolean;
  readonly durationMinutes?: number;
  readonly createdAt: string;
}

export function toTrainingModuleResponse(
  mod: TrainingModule,
): TrainingModuleResponse {
  return {
    id: mod.id,
    programId: mod.programId,
    title: mod.title,
    ...(mod.description !== undefined ? { description: mod.description } : {}),
    sortOrder: mod.sortOrder,
    required: mod.required,
    ...(mod.durationMinutes !== undefined
      ? { durationMinutes: mod.durationMinutes }
      : {}),
    createdAt: mod.createdAt.toISOString(),
  };
}

// --- TrainingProgram ---

export interface TrainingProgramResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly title: string;
  readonly description?: string;
  readonly objectives: readonly string[];
  readonly locale: string;
  readonly dialect?: string;
  readonly status: string;
  readonly modules: readonly TrainingModuleResponse[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toTrainingProgramResponse(
  program: TrainingProgram,
): TrainingProgramResponse {
  return {
    id: program.id,
    schoolId: program.schoolId,
    title: program.title,
    ...(program.description !== undefined
      ? { description: program.description }
      : {}),
    objectives: program.objectives,
    locale: program.locale,
    ...(program.dialect !== undefined ? { dialect: program.dialect } : {}),
    status: program.status,
    modules: program.modules.map(toTrainingModuleResponse),
    createdAt: program.createdAt.toISOString(),
    updatedAt: program.updatedAt.toISOString(),
  };
}

// --- TrainingEnrollment ---

export interface TrainingEnrollmentResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly programId: string;
  readonly volunteerUserId: string;
  readonly status: string;
  readonly enrolledAt: string;
  readonly completedAt?: string;
  readonly examReady: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toTrainingEnrollmentResponse(
  enrollment: TrainingEnrollment,
): TrainingEnrollmentResponse {
  return {
    id: enrollment.id,
    schoolId: enrollment.schoolId,
    programId: enrollment.programId,
    volunteerUserId: enrollment.volunteerUserId,
    status: enrollment.status,
    enrolledAt: enrollment.enrolledAt.toISOString(),
    ...(enrollment.completedAt !== undefined
      ? { completedAt: enrollment.completedAt.toISOString() }
      : {}),
    examReady: enrollment.examReady,
    createdAt: enrollment.createdAt.toISOString(),
    updatedAt: enrollment.updatedAt.toISOString(),
  };
}

// --- TrainingProgress ---

export interface TrainingProgressResponse {
  readonly id: string;
  readonly enrollmentId: string;
  readonly moduleId: string;
  readonly completed: boolean;
  readonly completedAt?: string;
  readonly score?: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toTrainingProgressResponse(
  progress: TrainingProgress,
): TrainingProgressResponse {
  return {
    id: progress.id,
    enrollmentId: progress.enrollmentId,
    moduleId: progress.moduleId,
    completed: progress.completed,
    ...(progress.completedAt !== undefined
      ? { completedAt: progress.completedAt.toISOString() }
      : {}),
    ...(progress.score !== undefined ? { score: progress.score } : {}),
    createdAt: progress.createdAt.toISOString(),
    updatedAt: progress.updatedAt.toISOString(),
  };
}

// --- TrainingExam ---

export interface TrainingExamResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly programId: string;
  readonly enrollmentId: string;
  readonly scheduledAt: string;
  readonly status: string;
  readonly passingScore: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toTrainingExamResponse(exam: TrainingExam): TrainingExamResponse {
  return {
    id: exam.id,
    schoolId: exam.schoolId,
    programId: exam.programId,
    enrollmentId: exam.enrollmentId,
    scheduledAt: exam.scheduledAt.toISOString(),
    status: exam.status,
    passingScore: exam.passingScore,
    createdAt: exam.createdAt.toISOString(),
    updatedAt: exam.updatedAt.toISOString(),
  };
}

// --- TrainingExamAttempt ---

export interface TrainingExamAttemptResponse {
  readonly id: string;
  readonly examId: string;
  readonly score: number;
  readonly passed: boolean;
  readonly submittedAt: string;
  readonly createdAt: string;
}

export function toTrainingExamAttemptResponse(
  attempt: TrainingExamAttempt,
): TrainingExamAttemptResponse {
  return {
    id: attempt.id,
    examId: attempt.examId,
    score: attempt.score,
    passed: attempt.passed,
    submittedAt: attempt.submittedAt.toISOString(),
    createdAt: attempt.createdAt.toISOString(),
  };
}
