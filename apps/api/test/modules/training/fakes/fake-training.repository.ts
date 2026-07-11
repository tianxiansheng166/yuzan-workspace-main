import type {
  TrainingEnrollment,
  TrainingEnrollmentStatus,
  TrainingExam,
  TrainingExamAttempt,
  TrainingExamStatus,
  TrainingProgram,
  TrainingProgress,
} from "../../../../src/modules/training/domain/training.types.js";
import type {
  ListEnrollmentsOptions,
  ListProgramsOptions,
  PaginatedResult,
  TrainingRepositoryPort,
} from "../../../../src/modules/training/ports/training-repository.port.js";

export class FakeTrainingRepository implements TrainingRepositoryPort {
  private programs: Map<string, TrainingProgram> = new Map();
  private enrollments: Map<string, TrainingEnrollment> = new Map();
  private progressEntries: Map<string, TrainingProgress> = new Map();
  private exams: Map<string, TrainingExam> = new Map();
  private attempts: TrainingExamAttempt[] = [];

  // --- Programs ---

  async findProgramById(
    schoolId: string,
    programId: string,
  ): Promise<TrainingProgram | null> {
    const p = this.programs.get(programId);
    return p && p.schoolId === schoolId ? p : null;
  }

  async listPrograms(
    schoolId: string,
    options: ListProgramsOptions,
  ): Promise<PaginatedResult<TrainingProgram>> {
    let items = [...this.programs.values()].filter(
      (p) => p.schoolId === schoolId,
    );

    if (options.status !== undefined) {
      items = items.filter((p) => p.status === options.status);
    }

    const limit = options.limit;
    const start = options.cursor
      ? items.findIndex((i) => i.id === options.cursor) + 1
      : 0;
    const slice = items.slice(start, start + limit);
    const hasMore = start + limit < items.length;

    return {
      items: slice,
      nextCursor: hasMore && slice.length > 0 ? slice[slice.length - 1].id : null,
      hasMore,
    };
  }

  async createProgram(program: TrainingProgram): Promise<TrainingProgram> {
    this.programs.set(program.id, program);
    return program;
  }

  async updateProgram(program: TrainingProgram): Promise<TrainingProgram> {
    this.programs.set(program.id, program);
    return program;
  }

  // --- Enrollments ---

  async findEnrollmentById(
    schoolId: string,
    enrollmentId: string,
  ): Promise<TrainingEnrollment | null> {
    const e = this.enrollments.get(enrollmentId);
    return e && e.schoolId === schoolId ? e : null;
  }

  async listEnrollmentsByVolunteer(
    schoolId: string,
    volunteerUserId: string,
    options: ListEnrollmentsOptions,
  ): Promise<PaginatedResult<TrainingEnrollment>> {
    let items = [...this.enrollments.values()].filter(
      (e) => e.schoolId === schoolId && e.volunteerUserId === volunteerUserId,
    );

    if (options.status !== undefined) {
      items = items.filter((e) => e.status === options.status);
    }

    const limit = options.limit;
    const start = options.cursor
      ? items.findIndex((i) => i.id === options.cursor) + 1
      : 0;
    const slice = items.slice(start, start + limit);
    const hasMore = start + limit < items.length;

    return {
      items: slice,
      nextCursor: hasMore && slice.length > 0 ? slice[slice.length - 1].id : null,
      hasMore,
    };
  }

  async listEnrollments(
    schoolId: string,
    programId: string,
    options: ListEnrollmentsOptions,
  ): Promise<PaginatedResult<TrainingEnrollment>> {
    let items = [...this.enrollments.values()].filter(
      (e) => e.schoolId === schoolId && e.programId === programId,
    );

    if (options.status !== undefined) {
      items = items.filter((e) => e.status === options.status);
    }

    const limit = options.limit;
    const start = options.cursor
      ? items.findIndex((i) => i.id === options.cursor) + 1
      : 0;
    const slice = items.slice(start, start + limit);
    const hasMore = start + limit < items.length;

    return {
      items: slice,
      nextCursor: hasMore && slice.length > 0 ? slice[slice.length - 1].id : null,
      hasMore,
    };
  }

  async createEnrollment(
    enrollment: TrainingEnrollment,
  ): Promise<TrainingEnrollment> {
    this.enrollments.set(enrollment.id, enrollment);
    return enrollment;
  }

  async updateEnrollmentStatus(
    schoolId: string,
    enrollmentId: string,
    status: TrainingEnrollmentStatus,
    completedAt?: Date,
  ): Promise<TrainingEnrollment> {
    const e = this.enrollments.get(enrollmentId);
    if (!e || e.schoolId !== schoolId) {
      throw new Error("Enrollment not found");
    }
    const updated: TrainingEnrollment = {
      ...e,
      status,
      examReady: status === "IN_PROGRESS" ? true : e.examReady,
      ...(completedAt !== undefined ? { completedAt } : {}),
      updatedAt: new Date(),
    };
    this.enrollments.set(enrollmentId, updated);
    return updated;
  }

  // --- Progress ---

  async findProgressByEnrollment(
    schoolId: string,
    enrollmentId: string,
  ): Promise<readonly TrainingProgress[]> {
    // Return progress entries that belong to enrollments in the given school
    const enrollment = this.enrollments.get(enrollmentId);
    if (!enrollment || enrollment.schoolId !== schoolId) {
      return [];
    }
    return [...this.progressEntries.values()].filter(
      (p) => p.enrollmentId === enrollmentId,
    );
  }

  async upsertProgress(progress: TrainingProgress): Promise<TrainingProgress> {
    const key = `${progress.enrollmentId}:${progress.moduleId}`;
    this.progressEntries.set(key, progress);
    return progress;
  }

  // --- Exams ---

  async findExamById(
    schoolId: string,
    examId: string,
  ): Promise<TrainingExam | null> {
    const e = this.exams.get(examId);
    return e && e.schoolId === schoolId ? e : null;
  }

  async listExamsByEnrollment(
    schoolId: string,
    enrollmentId: string,
  ): Promise<readonly TrainingExam[]> {
    return [...this.exams.values()].filter(
      (e) => e.schoolId === schoolId && e.enrollmentId === enrollmentId,
    );
  }

  async createExam(exam: TrainingExam): Promise<TrainingExam> {
    this.exams.set(exam.id, exam);
    return exam;
  }

  async updateExamStatus(
    schoolId: string,
    examId: string,
    status: TrainingExamStatus,
  ): Promise<TrainingExam> {
    const e = this.exams.get(examId);
    if (!e || e.schoolId !== schoolId) {
      throw new Error("Exam not found");
    }
    const updated: TrainingExam = {
      ...e,
      status,
      updatedAt: new Date(),
    };
    this.exams.set(examId, updated);
    return updated;
  }

  // --- Exam Attempts ---

  async createExamAttempt(
    attempt: TrainingExamAttempt,
  ): Promise<TrainingExamAttempt> {
    this.attempts.push(attempt);
    return attempt;
  }

  // --- Test helpers ---

  addProgram(program: TrainingProgram): void {
    this.programs.set(program.id, program);
  }

  addEnrollment(enrollment: TrainingEnrollment): void {
    this.enrollments.set(enrollment.id, enrollment);
  }

  addProgress(progress: TrainingProgress): void {
    const key = `${progress.enrollmentId}:${progress.moduleId}`;
    this.progressEntries.set(key, progress);
  }

  addExam(exam: TrainingExam): void {
    this.exams.set(exam.id, exam);
  }

  getEnrollment(id: string): TrainingEnrollment | undefined {
    return this.enrollments.get(id);
  }

  getExam(id: string): TrainingExam | undefined {
    return this.exams.get(id);
  }
}
