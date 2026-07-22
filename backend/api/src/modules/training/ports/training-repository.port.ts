import type {
  TrainingEnrollment,
  TrainingEnrollmentStatus,
  TrainingExam,
  TrainingExamAttempt,
  TrainingExamStatus,
  TrainingProgram,
  TrainingProgramStatus,
  TrainingProgress,
} from "../domain/training.types.js";

export const TRAINING_REPOSITORY = Symbol("TRAINING_REPOSITORY");

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface ListProgramsOptions {
  readonly status?: TrainingProgramStatus;
  readonly limit: number;
  readonly cursor?: string;
}

export interface ListEnrollmentsOptions {
  readonly status?: TrainingEnrollmentStatus;
  readonly limit: number;
  readonly cursor?: string;
}

export interface TrainingRepositoryPort {
  // Programs
  findProgramById(
    schoolId: string,
    programId: string,
  ): Promise<TrainingProgram | null>;

  listPrograms(
    schoolId: string,
    options: ListProgramsOptions,
  ): Promise<PaginatedResult<TrainingProgram>>;

  createProgram(program: TrainingProgram): Promise<TrainingProgram>;

  updateProgram(program: TrainingProgram): Promise<TrainingProgram>;

  // Enrollments
  findEnrollmentById(
    schoolId: string,
    enrollmentId: string,
  ): Promise<TrainingEnrollment | null>;

  listEnrollmentsByVolunteer(
    schoolId: string,
    volunteerUserId: string,
    options: ListEnrollmentsOptions,
  ): Promise<PaginatedResult<TrainingEnrollment>>;

  listEnrollments(
    schoolId: string,
    programId: string,
    options: ListEnrollmentsOptions,
  ): Promise<PaginatedResult<TrainingEnrollment>>;

  createEnrollment(
    enrollment: TrainingEnrollment,
  ): Promise<TrainingEnrollment>;

  updateEnrollmentStatus(
    schoolId: string,
    enrollmentId: string,
    status: TrainingEnrollmentStatus,
    completedAt?: Date,
  ): Promise<TrainingEnrollment>;

  // Progress
  findProgressByEnrollment(
    schoolId: string,
    enrollmentId: string,
  ): Promise<readonly TrainingProgress[]>;

  upsertProgress(progress: TrainingProgress): Promise<TrainingProgress>;

  // Exams
  findExamById(
    schoolId: string,
    examId: string,
  ): Promise<TrainingExam | null>;

  listExamsByEnrollment(
    schoolId: string,
    enrollmentId: string,
  ): Promise<readonly TrainingExam[]>;

  createExam(exam: TrainingExam): Promise<TrainingExam>;

  updateExamStatus(
    schoolId: string,
    examId: string,
    status: TrainingExamStatus,
  ): Promise<TrainingExam>;

  // Exam Attempts
  createExamAttempt(attempt: TrainingExamAttempt): Promise<TrainingExamAttempt>;
}
