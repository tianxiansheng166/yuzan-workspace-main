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
  private fail(): never {
    throw new TrainingUnavailableException();
  }

  // Programs
  async findProgramById(
    _schoolId: string,
    _programId: string,
  ): Promise<TrainingProgram | null> {
    this.fail();
  }

  async listPrograms(
    _schoolId: string,
    _options: ListProgramsOptions,
  ): Promise<PaginatedResult<TrainingProgram>> {
    this.fail();
  }

  async createProgram(_program: TrainingProgram): Promise<TrainingProgram> {
    this.fail();
  }

  async updateProgram(_program: TrainingProgram): Promise<TrainingProgram> {
    this.fail();
  }

  // Enrollments
  async findEnrollmentById(
    _schoolId: string,
    _enrollmentId: string,
  ): Promise<TrainingEnrollment | null> {
    this.fail();
  }

  async listEnrollmentsByVolunteer(
    _schoolId: string,
    _volunteerUserId: string,
    _options: ListEnrollmentsOptions,
  ): Promise<PaginatedResult<TrainingEnrollment>> {
    this.fail();
  }

  async listEnrollments(
    _schoolId: string,
    _programId: string,
    _options: ListEnrollmentsOptions,
  ): Promise<PaginatedResult<TrainingEnrollment>> {
    this.fail();
  }

  async createEnrollment(
    _enrollment: TrainingEnrollment,
  ): Promise<TrainingEnrollment> {
    this.fail();
  }

  async updateEnrollmentStatus(
    _schoolId: string,
    _enrollmentId: string,
    _status: TrainingEnrollmentStatus,
    _completedAt?: Date,
  ): Promise<TrainingEnrollment> {
    this.fail();
  }

  // Progress
  async findProgressByEnrollment(
    _schoolId: string,
    _enrollmentId: string,
  ): Promise<readonly TrainingProgress[]> {
    this.fail();
  }

  async upsertProgress(_progress: TrainingProgress): Promise<TrainingProgress> {
    this.fail();
  }

  // Exams
  async findExamById(
    _schoolId: string,
    _examId: string,
  ): Promise<TrainingExam | null> {
    this.fail();
  }

  async listExamsByEnrollment(
    _schoolId: string,
    _enrollmentId: string,
  ): Promise<readonly TrainingExam[]> {
    this.fail();
  }

  async createExam(_exam: TrainingExam): Promise<TrainingExam> {
    this.fail();
  }

  async updateExamStatus(
    _schoolId: string,
    _examId: string,
    _status: TrainingExamStatus,
  ): Promise<TrainingExam> {
    this.fail();
  }

  // Exam Attempts
  async createExamAttempt(
    _attempt: TrainingExamAttempt,
  ): Promise<TrainingExamAttempt> {
    this.fail();
  }
}
