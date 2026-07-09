import {
  assessmentTasks,
  readingMaterials,
  studentReports,
  targetOptions,
  writingTasks,
} from "./demo-data";
import type {
  AssessmentDashboardData,
  AssessmentManagementGateway,
  AssessmentTask,
  AssessmentTaskDetailData,
  CreateAssessmentTaskInput,
  MaterialOption,
  PreviewState,
  StudentAssessmentReport,
  StudentAssessmentReportsData,
  TargetOption,
} from "./types";

const qrReason =
  "二维码生成待依赖批准：当前任务范围不允许新增依赖，也不展示伪二维码。";

interface DemoStore {
  tasks: AssessmentTask[];
  reports: Record<string, StudentAssessmentReport>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createStore(): DemoStore {
  return {
    tasks: clone(assessmentTasks),
    reports: clone(studentReports),
  };
}

let demoStore = createStore();

function isPreviewStateError(previewState: PreviewState) {
  return previewState === "error";
}

function summarizeTargets(targetIds: string[], targets: TargetOption[]) {
  const selected = targets.filter((target) => targetIds.includes(target.id));
  if (selected.length === 0) {
    return "未选择目标";
  }

  const names = selected.map((target) => target.name);
  const studentCount = resolveStudentIds(targetIds, targets).length;
  return `${names.join(" · ")} · ${studentCount} 名学生（demo）`;
}

function resolveStudentIds(targetIds: string[], targets: TargetOption[]) {
  return Array.from(
    new Set(
      targets
        .filter((target) => targetIds.includes(target.id))
        .flatMap((target) => target.studentIds),
    ),
  );
}

function materialById(collection: MaterialOption[], id: string) {
  const item = collection.find((entry) => entry.id === id);
  if (!item) {
    throw new Error(`Material ${id} not found in demo gateway.`);
  }
  return item;
}

function taskById(taskId: string) {
  if (taskId === "demo") {
    return demoStore.tasks[0] ?? createDemoTask();
  }

  const task = demoStore.tasks.find((item) => item.id === taskId);
  if (!task) {
    throw new Error(`Assessment task ${taskId} not found in demo gateway.`);
  }
  return task;
}

function createDemoTask(): AssessmentTask {
  const now = new Date().toISOString();
  const id = "assessment-demo-fixed";
  return {
    id,
    title: "Demo 测评任务（直链复核）",
    readingMaterialId: "reading-snowline",
    writingTaskId: "writing-letter",
    opensAt: now,
    closesAt: now,
    targetIds: ["class-grade6-b2"],
    targetSummary: "六年级二班 · 3 名学生（demo）",
    anonymous: false,
    status: "live",
    demoLink: buildDemoLink(id),
    progress: {
      completedLabel: "demo",
      incompleteLabel: "unavailable",
      note: "真实完成/未完成人数待 Assessment API 接入后提供。",
    },
    reportStudentIds: ["student-lobsang", "student-tsering", "student-dechen"],
    createdBy: "演示教师",
    createdAt: now,
  };
}

function createDemoTaskId() {
  const timestamp = Date.now().toString(36);
  const randomSegment = Math.random().toString(36).slice(2, 8);
  return `assessment-demo-${timestamp}-${randomSegment}`;
}

function buildDemoLink(taskId: string) {
  const code = taskId.replace(/^assessment-demo-/, "");
  return {
    url: `https://demo.yuzan-next.local/assessment/${taskId}`,
    code,
    qrAvailable: false as const,
    qrReason,
  };
}

function createTaskFromInput(input: CreateAssessmentTaskInput): AssessmentTask {
  const targetIds = Array.from(new Set(input.targetIds));
  const reportStudentIds = resolveStudentIds(targetIds, targetOptions);
  const id = createDemoTaskId();
  return {
    id,
    title: input.title.trim(),
    readingMaterialId: input.readingMaterialId,
    writingTaskId: input.writingTaskId,
    opensAt: input.opensAt,
    closesAt: input.closesAt,
    targetIds,
    targetSummary: summarizeTargets(targetIds, targetOptions),
    anonymous: input.anonymous,
    status: "scheduled",
    demoLink: buildDemoLink(id),
    progress: {
      completedLabel: "demo",
      incompleteLabel: "unavailable",
      note: "真实完成/未完成人数待 Assessment API 接入后提供。",
    },
    reportStudentIds,
    createdBy: "当前演示教师",
    createdAt: new Date().toISOString(),
  };
}

function createDashboardData(tasks: AssessmentTask[]): AssessmentDashboardData {
  return {
    tasks,
    readingMaterials: clone(readingMaterials),
    writingTasks: clone(writingTasks),
    targets: clone(targetOptions),
  };
}

export function parsePreviewState(value: unknown): PreviewState {
  return value === "loading" || value === "empty" || value === "error"
    ? value
    : "complete";
}

export function resetAssessmentManagementDemoState() {
  demoStore = createStore();
}

function resolveDemoStudentId(studentId: string) {
  return studentId === "demo" ? "student-lobsang" : studentId;
}

export const assessmentManagementGateway: AssessmentManagementGateway = {
  async getDashboardData(
    previewState: PreviewState = "complete",
  ): Promise<AssessmentDashboardData> {
    if (isPreviewStateError(previewState)) {
      throw new Error("AssessmentManagementGateway demo unavailable.");
    }

    if (previewState === "empty") {
      return createDashboardData([]);
    }

    return createDashboardData(clone(demoStore.tasks));
  },

  async getAssessmentTaskDetail(
    taskId: string,
    previewState: PreviewState = "complete",
  ): Promise<AssessmentTaskDetailData | null> {
    if (isPreviewStateError(previewState)) {
      throw new Error("Assessment task detail demo unavailable.");
    }

    if (previewState === "empty") {
      return null;
    }

    const task = clone(taskById(taskId));
    return {
      task,
      readingMaterial: clone(
        materialById(readingMaterials, task.readingMaterialId),
      ),
      writingTask: clone(materialById(writingTasks, task.writingTaskId)),
      reports: task.reportStudentIds.flatMap((studentId) => {
        const report = demoStore.reports[studentId];
        return report ? [clone(report)] : [];
      }),
    };
  },

  async createAssessmentTask(
    input: CreateAssessmentTaskInput,
  ): Promise<AssessmentTask> {
    const task = createTaskFromInput(input);
    demoStore.tasks = [task, ...demoStore.tasks];
    return clone(task);
  },

  async deactivateAssessmentTask(taskId: string): Promise<AssessmentTask> {
    const task = taskById(taskId);
    task.status = "inactive";
    task.demoLink.deactivatedAt = new Date().toISOString();
    return clone(task);
  },

  async getStudentAssessmentReports(
    studentId: string,
    previewState: PreviewState = "complete",
  ): Promise<StudentAssessmentReportsData | null> {
    if (isPreviewStateError(previewState)) {
      throw new Error("Student assessment reports demo unavailable.");
    }

    if (previewState === "empty") {
      return null;
    }

    const resolvedStudentId = resolveDemoStudentId(studentId);
    const report = demoStore.reports[resolvedStudentId];
    if (!report) {
      throw new Error(`Student report ${studentId} not found in demo gateway.`);
    }

    return {
      report: clone(report),
      relatedTasks: demoStore.tasks
        .filter((task) => task.reportStudentIds.includes(resolvedStudentId))
        .map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          opensAt: task.opensAt,
        })),
    };
  },
};
