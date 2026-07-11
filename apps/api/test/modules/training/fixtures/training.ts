import type {
  TrainingProgram,
  TrainingEnrollment,
  TrainingProgress,
  TrainingExam,
  TrainingModule,
} from "../../../../src/modules/training/domain/training.types.js";

let nextProgramId = 1;
function programId(): string {
  return `prog-${nextProgramId++}`;
}

let nextModuleId = 1;
function moduleId(): string {
  return `mod-${nextModuleId++}`;
}

let nextEnrollmentId = 1;
function enrollmentId(): string {
  return `enr-${nextEnrollmentId++}`;
}

let nextProgressId = 1;
function progressId(): string {
  return `prg-${nextProgressId++}`;
}

let nextExamId = 1;
function examId(): string {
  return `exam-${nextExamId++}`;
}

export function trainingModule(
  overrides: Partial<TrainingModule> & { programId: string },
): TrainingModule {
  const now = new Date();
  return {
    id: moduleId(),
    title: "测试模块",
    description: undefined,
    sortOrder: 1,
    required: true,
    durationMinutes: undefined,
    createdAt: now,
    ...overrides,
  };
}

export function trainingProgram(
  overrides: Partial<TrainingProgram> & { schoolId: string },
): TrainingProgram {
  const now = new Date();
  return {
    id: programId(),
    title: "测试培训项目",
    description: undefined,
    objectives: ["掌握基础技能"],
    locale: "zh-CN",
    dialect: undefined,
    status: "PUBLISHED",
    modules: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function trainingEnrollment(
  overrides: Partial<TrainingEnrollment> & {
    schoolId: string;
    programId: string;
    volunteerUserId: string;
  },
): TrainingEnrollment {
  const now = new Date();
  return {
    id: enrollmentId(),
    status: "ENROLLED",
    enrolledAt: now,
    completedAt: undefined,
    examReady: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function trainingProgress(
  overrides: Partial<TrainingProgress> & {
    enrollmentId: string;
    moduleId: string;
  },
): TrainingProgress {
  const now = new Date();
  return {
    id: progressId(),
    completed: false,
    completedAt: undefined,
    score: undefined,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function trainingExam(
  overrides: Partial<TrainingExam> & {
    schoolId: string;
    programId: string;
    enrollmentId: string;
  },
): TrainingExam {
  const now = new Date();
  return {
    id: examId(),
    scheduledAt: new Date(now.getTime() + 86400000),
    status: "SCHEDULED",
    passingScore: 60,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
