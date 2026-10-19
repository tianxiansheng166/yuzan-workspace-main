import { Injectable } from "@nestjs/common";
import type {
  TrainingEnrollment,
  TrainingEnrollmentStatus,
  TrainingExam,
  TrainingExamAttempt,
  TrainingExamStatus,
  TrainingProgram,
  TrainingProgress,
} from "../domain/training.types.js";
import { TrainingUnavailableException } from "../domain/training.errors.js";
import type {
  ListEnrollmentsOptions,
  ListProgramsOptions,
  PaginatedResult,
  TrainingRepositoryPort,
} from "./training-repository.port.js";

@Injectable()
export class UnavailableTrainingRepository implements TrainingRepositoryPort {
  private fail(): Promise<never> {
    return Promise.reject(new TrainingUnavailableException());
  }

  // Programs
  findProgramById(
    _schoolId: string,
    _programId: string,
  ): Promise<TrainingProgram | null> {
    void _schoolId;
    void _programId;
    return this.fail();
  }

  listPrograms(
    _schoolId: string,
    _options: ListProgramsOptions,
  ): Promise<PaginatedResult<TrainingProgram>> {
    void _schoolId;
    void _options;
    return this.fail();
  }

  createProgram(_program: TrainingProgram): Promise<TrainingProgram> {
    void _program;
    return this.fail();
  }

  updateProgram(_program: TrainingProgram): Promise<TrainingProgram> {
    void _program;
    return this.fail();
  }

  // Enrollments
  findEnrollmentById(
    _schoolId: string,
    _enrollmentId: string,
  ): Promise<TrainingEnrollment | null> {
    void _schoolId;
    void _enrollmentId;
    return this.fail();
  }

  listEnrollmentsByVolunteer(
    _schoolId: string,
    _volunteerUserId: string,
    _options: ListEnrollmentsOptions,
  ): Promise<PaginatedResult<TrainingEnrollment>> {
    void _schoolId;
    void _volunteerUserId;
    void _options;
    return this.fail();
  }

  listEnrollments(
    _schoolId: string,
    _programId: string,
    _options: ListEnrollmentsOptions,
  ): Promise<PaginatedResult<TrainingEnrollment>> {
    void _schoolId;
    void _programId;
    void _options;
    return this.fail();
  }

  createEnrollment(
    _enrollment: TrainingEnrollment,
  ): Promise<TrainingEnrollment> {
    void _enrollment;
    return this.fail();
  }

  updateEnrollmentStatus(
    _schoolId: string,
    _enrollmentId: string,
    _status: TrainingEnrollmentStatus,
    _completedAt?: Date,
  ): Promise<TrainingEnrollment> {
    void _schoolId;
    void _enrollmentId;
    void _status;
    void _completedAt;
    return this.fail();
  }

  // Progress
  findProgressByEnrollment(
    _schoolId: string,
    _enrollmentId: string,
  ): Promise<readonly TrainingProgress[]> {
    void _schoolId;
    void _enrollmentId;
    return this.fail();
  }

  upsertProgress(_progress: TrainingProgress): Promise<TrainingProgress> {
    void _progress;
    return this.fail();
  }

  // Exams
  findExamById(
    _schoolId: string,
    _examId: string,
  ): Promise<TrainingExam | null> {
    void _schoolId;
    void _examId;
    return this.fail();
  }

  listExamsByEnrollment(
    _schoolId: string,
    _enrollmentId: string,
  ): Promise<readonly TrainingExam[]> {
    void _schoolId;
    void _enrollmentId;
    return this.fail();
  }

  createExam(_exam: TrainingExam): Promise<TrainingExam> {
    void _exam;
    return this.fail();
  }

  updateExamStatus(
    _schoolId: string,
    _examId: string,
    _status: TrainingExamStatus,
  ): Promise<TrainingExam> {
    void _schoolId;
    void _examId;
    void _status;
    return this.fail();
  }

  // Exam Attempts
  createExamAttempt(
    _attempt: TrainingExamAttempt,
  ): Promise<TrainingExamAttempt> {
    void _attempt;
    return this.fail();
  }
}
