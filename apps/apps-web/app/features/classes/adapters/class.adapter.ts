import type {
  ClassSummary,
  ClassDetail,
  StudentSummary,
  StudentAssessmentStatus,
  StudentReportStatus,
} from "~/features/classes/types";

export interface ClassListViewModel {
  id: string;
  name: string;
  grade: string;
  meta: string;
  syncLabel: string;
  syncTone: "success" | "warning" | "neutral" | "information";
}

export interface StudentViewModel {
  id: string;
  displayName: string;
  isDemo: boolean;
  assessmentLabel: string;
  assessmentTone: "neutral" | "warning" | "success" | "information";
  retestLabel: string;
  retestTone: "neutral" | "warning" | "success" | "information";
  reportLabel: string;
  reportTone: "neutral" | "warning" | "success" | "information";
}

export interface AssessmentViewModel {
  id: string;
  title: string;
  typeLabel: string;
  statusLabel: string;
  dueLabel: string;
}

const statusMap: Record<
  StudentAssessmentStatus,
  { label: string; tone: "neutral" | "warning" | "success" | "information" }
> = {
  "not-started": { label: "未开始", tone: "neutral" },
  "in-progress": { label: "进行中", tone: "warning" },
  submitted: { label: "已提交", tone: "information" },
  graded: { label: "已批改", tone: "success" },
  pending: { label: "待处理", tone: "warning" },
  unavailable: { label: "不可用", tone: "neutral" },
};

const reportStatusMap: Record<
  StudentReportStatus,
  { label: string; tone: "neutral" | "warning" | "success" | "information" }
> = {
  ready: { label: "已生成", tone: "success" },
  generating: { label: "生成中", tone: "warning" },
  pending: { label: "待生成", tone: "neutral" },
  unavailable: { label: "不可用", tone: "neutral" },
};

const assessmentTypeMap: Record<string, string> = {
  formative: "形成性测评",
  summative: "总结性测评",
  mock: "模拟测评",
};

export function adaptClassList(classes: ClassSummary[]): ClassListViewModel[] {
  return classes.map((c) => {
    const syncLabels: Record<
      string,
      { label: string; tone: ClassListViewModel["syncTone"] }
    > = {
      synced: { label: "已同步", tone: "success" },
      pending: { label: "同步中", tone: "warning" },
      offline: { label: "离线", tone: "neutral" },
      unavailable: { label: "不可用", tone: "information" },
    };
    const sync = syncLabels[c.syncStatus] ?? { label: "未知", tone: "neutral" };
    return {
      id: c.id,
      name: c.name,
      grade: c.grade,
      meta: `${c.studentCount} 名学生 · ${c.courseCount} 门课程 · ${c.assessmentCount} 个测评`,
      syncLabel: sync.label,
      syncTone: sync.tone,
    };
  });
}

export function adaptStudents(students: StudentSummary[]): StudentViewModel[] {
  return students.map((s) => ({
    id: s.id,
    displayName: s.displayName,
    isDemo: s.isDemo,
    assessmentLabel: statusMap[s.assessmentStatus].label,
    assessmentTone: statusMap[s.assessmentStatus].tone,
    retestLabel: statusMap[s.retestStatus].label,
    retestTone: statusMap[s.retestStatus].tone,
    reportLabel: reportStatusMap[s.reportStatus].label,
    reportTone: reportStatusMap[s.reportStatus].tone,
  }));
}

export function adaptAssessments(
  assessments: ClassDetail["assessments"],
): AssessmentViewModel[] {
  return assessments.map((a) => ({
    id: a.id,
    title: a.title,
    typeLabel: assessmentTypeMap[a.type] ?? a.type,
    statusLabel:
      a.status === "open"
        ? "进行中"
        : a.status === "closed"
          ? "已结束"
          : "草稿",
    dueLabel: a.dueDate ? `截止 ${a.dueDate}` : "无截止日期",
  }));
}


