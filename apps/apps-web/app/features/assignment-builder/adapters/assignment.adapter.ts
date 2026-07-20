import type {
  AssignmentDetail,
  AssignmentStatus,
  AssignmentSummary,
  AssignmentType,
  StudentProgress,
} from "../types";

export interface AssignmentListItemViewModel {
  id: string;
  className: string;
  typeLabel: string;
  title: string;
  statusLabel: string;
  statusTone: "neutral" | "warning" | "success" | "information";
  timeRange: string;
  completionText: string;
  isDemo: boolean;
}

export interface AssignmentDetailViewModel {
  id: string;
  className: string;
  typeLabel: string;
  title: string;
  description: string;
  statusLabel: string;
  statusTone: "neutral" | "warning" | "success" | "information";
  timeRange: string;
  configuration: string[];
  selectedContents: { id: string; kind: string; title: string }[];
  isDemo: boolean;
}

export interface StudentProgressViewModel {
  studentId: string;
  displayName: string;
  isDemo: boolean;
  progressLabel: string;
  progressTone: "neutral" | "warning" | "success" | "information";
  speechLabel: string;
  writtenLabel: string;
  reportLabel: string;
}

const typeLabels: Record<AssignmentType, string> = {
  learning: "学习任务",
  "first-assessment": "首次测评",
  retest: "复测",
  "speech-practice": "朗读练习",
  "written-practice": "书面练习",
  composite: "综合任务",
};

const statusLabels: Record<
  AssignmentStatus,
  { label: string; tone: AssignmentListItemViewModel["statusTone"] }
> = {
  draft: { label: "草稿", tone: "neutral" },
  scheduled: { label: "已计划", tone: "information" },
  active: { label: "进行中", tone: "warning" },
  completed: { label: "已完成", tone: "success" },
  unavailable: { label: "不可用", tone: "neutral" },
};

const progressLabels: Record<
  StudentProgress["progressStatus"],
  { label: string; tone: StudentProgressViewModel["progressTone"] }
> = {
  "not-started": { label: "未开始", tone: "neutral" },
  "in-progress": { label: "进行中", tone: "warning" },
  completed: { label: "已完成", tone: "success" },
  overdue: { label: "已逾期", tone: "warning" },
  unavailable: { label: "不可用", tone: "neutral" },
};

const activityLabels: Record<StudentProgress["speechStatus"], string> = {
  pending: "待完成",
  completed: "已完成",
  unavailable: "不可用",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function adaptAssignmentList(
  assignments: AssignmentSummary[],
): AssignmentListItemViewModel[] {
  return assignments.map((a) => {
    const status = statusLabels[a.status];
    return {
      id: a.id,
      className: a.className,
      typeLabel: typeLabels[a.type],
      title: a.title,
      statusLabel: status.label,
      statusTone: status.tone,
      timeRange: `${formatDateTime(a.startsAt)} – ${formatDateTime(a.dueAt)}`,
      completionText: `${Math.round(a.completionRatio * 100)}% 完成`,
      isDemo: a.isDemo,
    };
  });
}

export function adaptAssignmentDetail(
  assignment: AssignmentDetail,
): AssignmentDetailViewModel {
  const status = statusLabels[assignment.status];
  const config: string[] = [];
  if (assignment.allowRetest) config.push("允许复测");
  if (assignment.includeSpeech) config.push("包含朗读");
  if (assignment.includeWritten) config.push("包含书面练习");
  if (assignment.recommendNextCourse) config.push("完成后推荐课程");
  if (config.length === 0) config.push("无特殊配置");

  return {
    id: assignment.id,
    className: assignment.className,
    typeLabel: typeLabels[assignment.type],
    title: assignment.title,
    description: assignment.description,
    statusLabel: status.label,
    statusTone: status.tone,
    timeRange: `${formatDateTime(assignment.startsAt)} – ${formatDateTime(assignment.dueAt)}`,
    configuration: config,
    selectedContents: assignment.selectedContents,
    isDemo: assignment.isDemo,
  };
}

export function adaptStudentProgress(
  students: StudentProgress[],
): StudentProgressViewModel[] {
  return students.map((s) => {
    const progress = progressLabels[s.progressStatus];
    return {
      studentId: s.studentId,
      displayName: s.displayName,
      isDemo: s.isDemo,
      progressLabel: progress.label,
      progressTone: progress.tone,
      speechLabel: activityLabels[s.speechStatus],
      writtenLabel: activityLabels[s.writtenStatus],
      reportLabel: activityLabels[s.reportStatus],
    };
  });
}

export function getAssignmentTypeLabel(type: AssignmentType): string {
  return typeLabels[type];
}
