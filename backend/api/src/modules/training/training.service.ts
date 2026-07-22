import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AuthContext } from "../../common/security/auth.types.js";
import {
  TrainingConflictException,
  TrainingEnrollmentNotFoundException,
  TrainingExamNotFoundException,
  TrainingForbiddenException,
  TrainingProgramNotFoundException,
} from "./domain/training.errors.js";
import type {
  TrainingEnrollment,
  TrainingExam,
  TrainingProgram,
  TrainingProgress,
} from "./domain/training.types.js";
import {
  toTrainingEnrollmentResponse,
  toTrainingExamAttemptResponse,
  toTrainingExamResponse,
  toTrainingProgramResponse,
  toTrainingProgressResponse,
} from "./dto/training.response.js";
import type { CreateProgramDto } from "./dto/training.dto.js";
import type {
  ListEnrollmentsOptions,
  ListProgramsOptions,
  TrainingRepositoryPort,
} from "./ports/training-repository.port.js";
import { TRAINING_REPOSITORY } from "./ports/training-repository.port.js";
import { TrainingPolicy } from "./training.policy.js";

@Injectable()
export class TrainingService {
  private readonly policy = new TrainingPolicy();

  constructor(
    @Inject(TRAINING_REPOSITORY)
    private readonly repo: TrainingRepositoryPort,
  ) {}

  // --- Programs ---

  async listPrograms(
    auth: AuthContext,
    schoolId: string,
    options: ListProgramsOptions,
  ) {
    if (!this.policy.canListPrograms(auth, schoolId)) {
      throw new TrainingForbiddenException();
    }

    const result = await this.repo.listPrograms(schoolId, options);
    return {
      items: result.items.map(toTrainingProgramResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async getProgram(auth: AuthContext, schoolId: string, programId: string) {
    if (!this.policy.canListPrograms(auth, schoolId)) {
      throw new TrainingForbiddenException();
    }

    const program = await this.repo.findProgramById(schoolId, programId);
    if (!program) {
      throw new TrainingProgramNotFoundException();
    }

    return toTrainingProgramResponse(program);
  }

  async createProgram(
    auth: AuthContext,
    schoolId: string,
    dto: CreateProgramDto,
  ) {
    if (!this.policy.canManagePrograms(auth, schoolId)) {
      throw new TrainingForbiddenException();
    }

    const now = new Date();
    const program: TrainingProgram = {
      id: randomUUID(),
      schoolId,
      title: dto.title,
      objectives: dto.objectives,
      locale: dto.locale,
      status: "DRAFT",
      modules: [],
      createdAt: now,
      updatedAt: now,
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
      ...(dto.dialect !== undefined ? { dialect: dto.dialect } : {}),
    };

    const saved = await this.repo.createProgram(program);
    return toTrainingProgramResponse(saved);
  }

  async updateProgram(
    auth: AuthContext,
    schoolId: string,
    programId: string,
    dto: {
      title?: string;
      description?: string;
      objectives?: readonly string[];
    },
  ) {
    if (!this.policy.canManagePrograms(auth, schoolId)) {
      throw new TrainingForbiddenException();
    }

    const program = await this.repo.findProgramById(schoolId, programId);
    if (!program) {
      throw new TrainingProgramNotFoundException();
    }

    if (program.status !== "DRAFT") {
      throw new TrainingConflictException(
        `状态为 ${program.status} 的培训项目不可编辑，只能编辑 DRAFT`,
      );
    }

    const updated: TrainingProgram = {
      ...program,
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
      ...(dto.objectives !== undefined ? { objectives: dto.objectives } : {}),
      updatedAt: new Date(),
    };

    const saved = await this.repo.updateProgram(updated);
    return toTrainingProgramResponse(saved);
  }

  // --- Enrollments ---

  async enroll(
    auth: AuthContext,
    schoolId: string,
    programId: string,
    volunteerUserId: string,
  ) {
    if (!this.policy.canEnroll(auth, schoolId, volunteerUserId)) {
      throw new TrainingForbiddenException();
    }

    const program = await this.repo.findProgramById(schoolId, programId);
    if (!program) {
      throw new TrainingProgramNotFoundException();
    }

    if (program.status !== "PUBLISHED") {
      throw new TrainingConflictException("只能报名已发布的培训项目");
    }

    const now = new Date();
    const enrollment: TrainingEnrollment = {
      id: randomUUID(),
      schoolId,
      programId,
      volunteerUserId,
      status: "ENROLLED",
      enrolledAt: now,
      examReady: false,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.repo.createEnrollment(enrollment);
    return toTrainingEnrollmentResponse(saved);
  }

  async getMyEnrollments(
    auth: AuthContext,
    schoolId: string,
    options: ListEnrollmentsOptions,
  ) {
    if (!this.policy.canListPrograms(auth, schoolId)) {
      throw new TrainingForbiddenException();
    }

    const result = await this.repo.listEnrollmentsByVolunteer(
      schoolId,
      auth.principal.userId,
      options,
    );
    return {
      items: result.items.map(toTrainingEnrollmentResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async listEnrollments(
    auth: AuthContext,
    schoolId: string,
    programId: string,
    options: ListEnrollmentsOptions,
  ) {
    if (!this.policy.canListEnrollments(auth, schoolId)) {
      throw new TrainingForbiddenException();
    }

    const result = await this.repo.listEnrollments(
      schoolId,
      programId,
      options,
    );
    return {
      items: result.items.map(toTrainingEnrollmentResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  // --- Progress ---

  async updateProgress(
    auth: AuthContext,
    schoolId: string,
    enrollmentId: string,
    moduleId: string,
    completed: boolean,
    score?: number,
  ) {
    const enrollment = await this.repo.findEnrollmentById(
      schoolId,
      enrollmentId,
    );
    if (!enrollment) {
      throw new TrainingEnrollmentNotFoundException();
    }

    if (
      !this.policy.canViewOwnEnrollment(auth, schoolId, enrollment) &&
      !this.policy.canManagePrograms(auth, schoolId)
    ) {
      throw new TrainingForbiddenException();
    }

    const now = new Date();
    const progress: TrainingProgress = {
      id: randomUUID(),
      enrollmentId,
      moduleId,
      completed,
      ...(completed ? { completedAt: now } : {}),
      ...(score !== undefined ? { score } : {}),
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.repo.upsertProgress(progress);

    // Check if all required modules are completed to mark examReady
    await this.checkExamReadiness(schoolId, enrollmentId);

    return toTrainingProgressResponse(saved);
  }

  async getProgress(auth: AuthContext, schoolId: string, enrollmentId: string) {
    const enrollment = await this.repo.findEnrollmentById(
      schoolId,
      enrollmentId,
    );
    if (!enrollment) {
      throw new TrainingEnrollmentNotFoundException();
    }

    if (
      !this.policy.canViewOwnEnrollment(auth, schoolId, enrollment) &&
      !this.policy.canManagePrograms(auth, schoolId)
    ) {
      throw new TrainingForbiddenException();
    }

    const progress = await this.repo.findProgressByEnrollment(
      schoolId,
      enrollmentId,
    );
    return progress.map(toTrainingProgressResponse);
  }

  // --- Exams ---

  async scheduleExam(
    auth: AuthContext,
    schoolId: string,
    enrollmentId: string,
    scheduledAt: Date,
    passingScore: number,
  ) {
    if (!this.policy.canManageExams(auth, schoolId)) {
      throw new TrainingForbiddenException();
    }

    const enrollment = await this.repo.findEnrollmentById(
      schoolId,
      enrollmentId,
    );
    if (!enrollment) {
      throw new TrainingEnrollmentNotFoundException();
    }

    if (!enrollment.examReady) {
      throw new TrainingConflictException(
        "报名尚未完成所有必修模块，无法安排考试",
      );
    }

    const now = new Date();
    const exam: TrainingExam = {
      id: randomUUID(),
      schoolId,
      programId: enrollment.programId,
      enrollmentId,
      scheduledAt,
      status: "SCHEDULED",
      passingScore,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.repo.createExam(exam);
    return toTrainingExamResponse(saved);
  }

  async submitAttempt(
    auth: AuthContext,
    schoolId: string,
    examId: string,
    score: number,
  ) {
    const exam = await this.repo.findExamById(schoolId, examId);
    if (!exam) {
      throw new TrainingExamNotFoundException();
    }

    const enrollment = await this.repo.findEnrollmentById(
      schoolId,
      exam.enrollmentId,
    );
    if (!enrollment) {
      throw new TrainingEnrollmentNotFoundException();
    }

    if (
      !this.policy.canViewOwnEnrollment(auth, schoolId, enrollment) &&
      !this.policy.canManageExams(auth, schoolId)
    ) {
      throw new TrainingForbiddenException();
    }

    const passed = score >= exam.passingScore;
    const now = new Date();

    const attempt = await this.repo.createExamAttempt({
      id: randomUUID(),
      examId,
      score,
      passed,
      submittedAt: now,
      createdAt: now,
    });

    // Update exam status
    const examStatus = passed ? "PASSED" : "FAILED";
    await this.repo.updateExamStatus(schoolId, examId, examStatus);

    // Update enrollment status based on exam result
    if (passed) {
      await this.repo.updateEnrollmentStatus(
        schoolId,
        exam.enrollmentId,
        "COMPLETED",
        now,
      );
    }

    return toTrainingExamAttemptResponse(attempt);
  }

  async getExamResults(auth: AuthContext, schoolId: string, examId: string) {
    const exam = await this.repo.findExamById(schoolId, examId);
    if (!exam) {
      throw new TrainingExamNotFoundException();
    }

    const enrollment = await this.repo.findEnrollmentById(
      schoolId,
      exam.enrollmentId,
    );
    if (!enrollment) {
      throw new TrainingEnrollmentNotFoundException();
    }

    if (
      !this.policy.canViewOwnEnrollment(auth, schoolId, enrollment) &&
      !this.policy.canManageExams(auth, schoolId)
    ) {
      throw new TrainingForbiddenException();
    }

    return toTrainingExamResponse(exam);
  }

  // --- Private helpers ---

  private async checkExamReadiness(
    schoolId: string,
    enrollmentId: string,
  ): Promise<void> {
    const enrollment = await this.repo.findEnrollmentById(
      schoolId,
      enrollmentId,
    );
    if (!enrollment) return;

    const program = await this.repo.findProgramById(
      schoolId,
      enrollment.programId,
    );
    if (!program) return;

    const requiredModules = program.modules.filter((m) => m.required);
    if (requiredModules.length === 0) return;

    const progress = await this.repo.findProgressByEnrollment(
      schoolId,
      enrollmentId,
    );

    const completedModuleIds = new Set(
      progress.filter((p) => p.completed).map((p) => p.moduleId),
    );

    const allRequiredCompleted = requiredModules.every((m) =>
      completedModuleIds.has(m.id),
    );

    if (allRequiredCompleted && !enrollment.examReady) {
      await this.repo.updateEnrollmentStatus(
        schoolId,
        enrollmentId,
        "IN_PROGRESS",
      );
      // Note: The repository implementation should handle setting examReady = true
      // when updateEnrollmentStatus is called. This is a domain hint.
    }
  }
}
