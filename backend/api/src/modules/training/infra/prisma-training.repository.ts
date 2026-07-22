import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../shared/database/prisma.service.js";
import type {
  TrainingEnrollment,
  TrainingEnrollmentStatus,
  TrainingExam,
  TrainingExamAttempt,
  TrainingExamStatus,
  TrainingModule,
  TrainingProgram,
  TrainingProgramStatus,
  TrainingProgress,
} from "../domain/training.types.js";
import type {
  ListEnrollmentsOptions,
  ListProgramsOptions,
  PaginatedResult,
  TrainingRepositoryPort,
} from "../ports/training-repository.port.js";

const programInclude = { modules: { orderBy: { sortOrder: "asc" as const } } };

@Injectable()
export class PrismaTrainingRepository implements TrainingRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findProgramById(
    schoolId: string,
    programId: string,
  ): Promise<TrainingProgram | null> {
    const row = await this.prisma.trainingProgram.findFirst({
      where: { schoolId, id: programId },
      include: programInclude,
    });
    return row ? toProgram(row) : null;
  }

  async listPrograms(
    schoolId: string,
    options: ListProgramsOptions,
  ): Promise<PaginatedResult<TrainingProgram>> {
    const rows = await this.prisma.trainingProgram.findMany({
      where: {
        schoolId,
        ...(options.status ? { status: options.status } : {}),
        ...(options.cursor ? { id: { gt: options.cursor } } : {}),
      },
      orderBy: { id: "asc" },
      take: options.limit + 1,
      include: programInclude,
    });
    const hasMore = rows.length > options.limit;
    const items = hasMore ? rows.slice(0, options.limit) : rows;
    return {
      items: items.map(toProgram),
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
      hasMore,
    };
  }

  async createProgram(program: TrainingProgram): Promise<TrainingProgram> {
    const row = await this.prisma.trainingProgram.create({
      data: {
        id: program.id,
        schoolId: program.schoolId,
        title: program.title,
        objectives: [...program.objectives],
        locale: program.locale,
        status: program.status,
        createdAt: program.createdAt,
        updatedAt: program.updatedAt,
        ...(program.description ? { description: program.description } : {}),
        ...(program.dialect ? { dialect: program.dialect } : {}),
        modules: {
          create: program.modules.map((module) => ({
            id: module.id,
            schoolId: program.schoolId,
            title: module.title,
            sortOrder: module.sortOrder,
            required: module.required,
            createdAt: module.createdAt,
            ...(module.description ? { description: module.description } : {}),
            ...(module.durationMinutes !== undefined
              ? { durationMinutes: module.durationMinutes }
              : {}),
          })),
        },
      },
      include: programInclude,
    });
    return toProgram(row);
  }

  async updateProgram(program: TrainingProgram): Promise<TrainingProgram> {
    const result = await this.prisma.trainingProgram.updateMany({
      where: { schoolId: program.schoolId, id: program.id },
      data: {
        title: program.title,
        description: program.description ?? null,
        objectives: [...program.objectives],
        locale: program.locale,
        dialect: program.dialect ?? null,
        status: program.status,
      },
    });
    if (result.count !== 1) throw new Error("TRAINING_PROGRAM_NOT_FOUND");
    const updated = await this.findProgramById(program.schoolId, program.id);
    if (!updated) throw new Error("TRAINING_PROGRAM_NOT_FOUND");
    return updated;
  }

  async findEnrollmentById(
    schoolId: string,
    enrollmentId: string,
  ): Promise<TrainingEnrollment | null> {
    const row = await this.prisma.trainingEnrollment.findFirst({
      where: { schoolId, id: enrollmentId },
    });
    return row ? toEnrollment(row) : null;
  }

  async listEnrollmentsByVolunteer(
    schoolId: string,
    volunteerUserId: string,
    options: ListEnrollmentsOptions,
  ): Promise<PaginatedResult<TrainingEnrollment>> {
    return this.listEnrollmentRows({ schoolId, volunteerUserId }, options);
  }

  async listEnrollments(
    schoolId: string,
    programId: string,
    options: ListEnrollmentsOptions,
  ): Promise<PaginatedResult<TrainingEnrollment>> {
    return this.listEnrollmentRows(
      { schoolId, ...(programId ? { programId } : {}) },
      options,
    );
  }

  async createEnrollment(
    enrollment: TrainingEnrollment,
  ): Promise<TrainingEnrollment> {
    const row = await this.prisma.trainingEnrollment.create({
      data: {
        id: enrollment.id,
        schoolId: enrollment.schoolId,
        programId: enrollment.programId,
        volunteerUserId: enrollment.volunteerUserId,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
        examReady: enrollment.examReady,
        createdAt: enrollment.createdAt,
        updatedAt: enrollment.updatedAt,
        ...(enrollment.completedAt
          ? { completedAt: enrollment.completedAt }
          : {}),
      },
    });
    return toEnrollment(row);
  }

  async updateEnrollmentStatus(
    schoolId: string,
    enrollmentId: string,
    status: TrainingEnrollmentStatus,
    completedAt?: Date,
  ): Promise<TrainingEnrollment> {
    const result = await this.prisma.trainingEnrollment.updateMany({
      where: { schoolId, id: enrollmentId },
      data: {
        status,
        ...(status === "IN_PROGRESS" ? { examReady: true } : {}),
        ...(completedAt ? { completedAt } : {}),
      },
    });
    if (result.count !== 1) throw new Error("TRAINING_ENROLLMENT_NOT_FOUND");
    const updated = await this.findEnrollmentById(schoolId, enrollmentId);
    if (!updated) throw new Error("TRAINING_ENROLLMENT_NOT_FOUND");
    return updated;
  }

  async findProgressByEnrollment(
    schoolId: string,
    enrollmentId: string,
  ): Promise<readonly TrainingProgress[]> {
    const rows = await this.prisma.trainingProgress.findMany({
      where: { schoolId, enrollmentId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toProgress);
  }

  async upsertProgress(progress: TrainingProgress): Promise<TrainingProgress> {
    const enrollment = await this.prisma.trainingEnrollment.findUnique({
      where: { id: progress.enrollmentId },
    });
    if (!enrollment) throw new Error("TRAINING_ENROLLMENT_NOT_FOUND");
    const module = await this.prisma.trainingModule.findFirst({
      where: {
        id: progress.moduleId,
        schoolId: enrollment.schoolId,
        programId: enrollment.programId,
      },
    });
    if (!module) throw new Error("TRAINING_MODULE_NOT_FOUND");
    const row = await this.prisma.trainingProgress.upsert({
      where: {
        schoolId_enrollmentId_moduleId: {
          schoolId: enrollment.schoolId,
          enrollmentId: progress.enrollmentId,
          moduleId: progress.moduleId,
        },
      },
      create: {
        id: progress.id,
        schoolId: enrollment.schoolId,
        enrollmentId: progress.enrollmentId,
        moduleId: progress.moduleId,
        completed: progress.completed,
        completedAt: progress.completedAt ?? null,
        score: progress.score ?? null,
        createdAt: progress.createdAt,
        updatedAt: progress.updatedAt,
      },
      update: {
        completed: progress.completed,
        completedAt: progress.completedAt ?? null,
        score: progress.score ?? null,
      },
    });
    return toProgress(row);
  }

  async findExamById(
    schoolId: string,
    examId: string,
  ): Promise<TrainingExam | null> {
    const row = await this.prisma.trainingExam.findFirst({
      where: { schoolId, id: examId },
    });
    return row ? toExam(row) : null;
  }

  async listExamsByEnrollment(
    schoolId: string,
    enrollmentId: string,
  ): Promise<readonly TrainingExam[]> {
    const rows = await this.prisma.trainingExam.findMany({
      where: { schoolId, enrollmentId },
      orderBy: { scheduledAt: "desc" },
    });
    return rows.map(toExam);
  }

  async createExam(exam: TrainingExam): Promise<TrainingExam> {
    const row = await this.prisma.trainingExam.create({ data: { ...exam } });
    return toExam(row);
  }

  async updateExamStatus(
    schoolId: string,
    examId: string,
    status: TrainingExamStatus,
  ): Promise<TrainingExam> {
    const result = await this.prisma.trainingExam.updateMany({
      where: { schoolId, id: examId },
      data: { status },
    });
    if (result.count !== 1) throw new Error("TRAINING_EXAM_NOT_FOUND");
    const updated = await this.findExamById(schoolId, examId);
    if (!updated) throw new Error("TRAINING_EXAM_NOT_FOUND");
    return updated;
  }

  async createExamAttempt(
    attempt: TrainingExamAttempt,
  ): Promise<TrainingExamAttempt> {
    const exam = await this.prisma.trainingExam.findUnique({
      where: { id: attempt.examId },
    });
    if (!exam) throw new Error("TRAINING_EXAM_NOT_FOUND");
    const row = await this.prisma.trainingExamAttempt.create({
      data: { ...attempt, schoolId: exam.schoolId },
    });
    return toExamAttempt(row);
  }

  private async listEnrollmentRows(
    where: { schoolId: string; volunteerUserId?: string; programId?: string },
    options: ListEnrollmentsOptions,
  ): Promise<PaginatedResult<TrainingEnrollment>> {
    const rows = await this.prisma.trainingEnrollment.findMany({
      where: {
        ...where,
        ...(options.status ? { status: options.status } : {}),
        ...(options.cursor ? { id: { gt: options.cursor } } : {}),
      },
      orderBy: { id: "asc" },
      take: options.limit + 1,
    });
    const hasMore = rows.length > options.limit;
    const items = hasMore ? rows.slice(0, options.limit) : rows;
    return {
      items: items.map(toEnrollment),
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
      hasMore,
    };
  }
}

function toProgram(row: Record<string, unknown>): TrainingProgram {
  const modules = (row.modules ?? []) as Record<string, unknown>[];
  return {
    id: row.id as string,
    schoolId: row.schoolId as string,
    title: row.title as string,
    objectives: row.objectives as string[],
    locale: row.locale as string,
    status: row.status as TrainingProgramStatus,
    modules: modules.map(toModule),
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
    ...(row.description ? { description: row.description as string } : {}),
    ...(row.dialect ? { dialect: row.dialect as string } : {}),
  };
}

function toModule(row: Record<string, unknown>): TrainingModule {
  return {
    id: row.id as string,
    programId: row.programId as string,
    title: row.title as string,
    sortOrder: row.sortOrder as number,
    required: row.required as boolean,
    createdAt: row.createdAt as Date,
    ...(row.description ? { description: row.description as string } : {}),
    ...(row.durationMinutes !== null && row.durationMinutes !== undefined
      ? { durationMinutes: row.durationMinutes as number }
      : {}),
  };
}

function toEnrollment(row: Record<string, unknown>): TrainingEnrollment {
  return {
    id: row.id as string,
    schoolId: row.schoolId as string,
    programId: row.programId as string,
    volunteerUserId: row.volunteerUserId as string,
    status: row.status as TrainingEnrollmentStatus,
    enrolledAt: row.enrolledAt as Date,
    examReady: row.examReady as boolean,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
    ...(row.completedAt ? { completedAt: row.completedAt as Date } : {}),
  };
}

function toProgress(row: Record<string, unknown>): TrainingProgress {
  return {
    id: row.id as string,
    enrollmentId: row.enrollmentId as string,
    moduleId: row.moduleId as string,
    completed: row.completed as boolean,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
    ...(row.completedAt ? { completedAt: row.completedAt as Date } : {}),
    ...(row.score !== null && row.score !== undefined
      ? { score: row.score as number }
      : {}),
  };
}

function toExam(row: Record<string, unknown>): TrainingExam {
  return {
    id: row.id as string,
    schoolId: row.schoolId as string,
    programId: row.programId as string,
    enrollmentId: row.enrollmentId as string,
    scheduledAt: row.scheduledAt as Date,
    status: row.status as TrainingExamStatus,
    passingScore: row.passingScore as number,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
  };
}

function toExamAttempt(row: Record<string, unknown>): TrainingExamAttempt {
  return {
    id: row.id as string,
    examId: row.examId as string,
    score: row.score as number,
    passed: row.passed as boolean,
    submittedAt: row.submittedAt as Date,
    createdAt: row.createdAt as Date,
  };
}
