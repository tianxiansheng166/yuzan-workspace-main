import type {
  RecommendationState,
  SubmissionDetail,
  SubmissionReviewStatus,
  SubmissionSummary,
  TeacherReviewState,
} from "../types";

type StatusTone = "neutral" | "success" | "warning" | "danger" | "information";

export interface SubmissionSummaryViewModel {
  id: string;
  className: string;
  studentDisplayName: string;
  assignmentTitle: string;
  submissionTypeLabel: string;
  submittedAt: string;
  reviewStatusLabel: string;
  reviewStatusTone: StatusTone;
  attentionLabel: string;
  overdueLabel: string;
  aiAssistLabel: string;
  aiAssistTone: StatusTone;
  markerLabel: string;
  markerTone: StatusTone;
}

export interface SubmissionDetailViewModel extends SubmissionSummaryViewModel {
  schoolScopedLabel: string;
  taskDescription: string;
  readingTextTitle: string;
  recordingLabel: string;
  aiProcessingLabel: string;
  reportLabel: string;
  recommendationSummary: string;
  teacherReviewLabel: string;
  previousSubmissionLabel: string;
}

export interface ReviewFilterOptions {
  classOptions: string[];
  taskOptions: SubmissionSummary["submissionType"][];
  statusOptions: ReviewStatusFilter[];
}

export type ReviewStatusFilter =
  "all" | SubmissionReviewStatus | "attention" | "overdue" | "reviewed";

export interface ReviewFilterState {
  className: string;
  taskType: "all" | SubmissionSummary["submissionType"];
  status: ReviewStatusFilter;
  timeOrder: "newest" | "oldest";
}

const submissionTypeMap = {
  "initial-assessment": "首次测评",
  retest: "复测",
  "reading-practice": "朗读练习",
  "written-practice": "书面练习",
  "integrated-task": "综合任务",
} as const;

const reviewStatusMap: Record<
  SubmissionReviewStatus,
  { label: string; tone: StatusTone }
> = {
  "needs-review": { label: "待复核", tone: "warning" },
  priority: { label: "优先处理", tone: "danger" },
  returned: { label: "已退回修改", tone: "warning" },
  resubmitted: { label: "学生已重交", tone: "information" },
  completed: { label: "已完成", tone: "success" },
  unavailable: { label: "不可用", tone: "neutral" },
};

const aiAssistMap = {
  demo: { label: "AI 辅助 demo", tone: "information" as const },
  pending: { label: "AI 辅助 pending", tone: "warning" as const },
  unavailable: { label: "AI 辅助 unavailable", tone: "neutral" as const },
};

const markerMap = {
  demo: { label: "DEMO", tone: "information" as const },
  pending: { label: "PENDING", tone: "warning" as const },
  unavailable: { label: "UNAVAILABLE", tone: "neutral" as const },
};

const reportLabelMap = {
  pending: "报告 pending",
  ready: "报告 ready",
  unavailable: "报告 unavailable",
} as const;

const recommendationMap: Record<RecommendationState, string> = {
  demo: "前端 demo 推荐",
  accepted: "教师已接受推荐",
  adjusted: "教师已调整推荐",
  pending: "推荐待确认",
};

const teacherReviewMap: Record<TeacherReviewState, string> = {
  pending: "教师复核 pending",
  "in-review": "教师复核进行中",
  reviewed: "教师已复核",
  returned: "教师已退回",
  unavailable: "教师复核 unavailable",
};

export function buildReviewFilterOptions(
  submissions: SubmissionSummary[],
): ReviewFilterOptions {
  return {
    classOptions: Array.from(
      new Set(submissions.map((item) => item.className)),
    ),
    taskOptions: Array.from(
      new Set(submissions.map((item) => item.submissionType)),
    ),
    statusOptions: [
      "all",
      "attention",
      "overdue",
      "reviewed",
      "needs-review",
      "priority",
      "returned",
      "resubmitted",
      "completed",
      "unavailable",
    ],
  };
}

export function filterSubmissionSummaries(
  submissions: SubmissionSummary[],
  filters: ReviewFilterState,
): SubmissionSummary[] {
  return submissions.filter((item) => {
    if (filters.className !== "all" && item.className !== filters.className) {
      return false;
    }

    if (
      filters.taskType !== "all" &&
      item.submissionType !== filters.taskType
    ) {
      return false;
    }

    if (filters.status === "attention" && !item.needsAttention) {
      return false;
    }

    if (filters.status === "overdue" && !item.isOverdue) {
      return false;
    }

    if (filters.status === "reviewed" && item.reviewStatus !== "completed") {
      return false;
    }

    if (
      filters.status !== "all" &&
      filters.status !== "attention" &&
      filters.status !== "overdue" &&
      filters.status !== "reviewed" &&
      item.reviewStatus !== filters.status
    ) {
      return false;
    }

    return true;
  });
}

const statusPriority: Record<SubmissionReviewStatus, number> = {
  priority: 0,
  resubmitted: 1,
  "needs-review": 2,
  returned: 3,
  unavailable: 4,
  completed: 5,
};

export function sortSubmissionSummaries(
  submissions: SubmissionSummary[],
  direction: "newest" | "oldest" = "newest",
): SubmissionSummary[] {
  return [...submissions].sort((left, right) => {
    const laneDifference =
      statusPriority[left.reviewStatus] - statusPriority[right.reviewStatus];
    if (laneDifference !== 0) return laneDifference;

    return direction === "newest"
      ? right.submittedAt.localeCompare(left.submittedAt)
      : left.submittedAt.localeCompare(right.submittedAt);
  });
}

export function adaptSubmissionSummary(
  item: SubmissionSummary,
): SubmissionSummaryViewModel {
  return {
    id: item.id,
    className: item.className,
    studentDisplayName: item.studentDisplayName,
    assignmentTitle: item.assignmentTitle,
    submissionTypeLabel: submissionTypeMap[item.submissionType],
    submittedAt: item.submittedAt,
    reviewStatusLabel: reviewStatusMap[item.reviewStatus].label,
    reviewStatusTone: reviewStatusMap[item.reviewStatus].tone,
    attentionLabel: item.needsAttention ? "需要关注" : "常规处理",
    overdueLabel: item.isOverdue ? "逾期" : "未逾期",
    aiAssistLabel: aiAssistMap[item.aiAssistState].label,
    aiAssistTone: aiAssistMap[item.aiAssistState].tone,
    markerLabel: markerMap[item.marker].label,
    markerTone: markerMap[item.marker].tone,
  };
}

export function adaptSubmissionDetail(
  item: SubmissionDetail,
): SubmissionDetailViewModel {
  const base = adaptSubmissionSummary(item);

  return {
    ...base,
    schoolScopedLabel: item.schoolScopedLabel,
    taskDescription: item.taskDescription,
    readingTextTitle: item.readingTextTitle,
    recordingLabel: item.audioMetadata.recordingSubmitted
      ? `录音已提交 · ${item.audioMetadata.durationLabel}`
      : "录音 unavailable",
    aiProcessingLabel: aiAssistMap[item.audioMetadata.aiProcessingStatus].label,
    reportLabel: reportLabelMap[item.reportState],
    recommendationSummary: item.recommendationEntries
      .map((entry) => `${entry.title} · ${recommendationMap[entry.state]}`)
      .join(" / "),
    teacherReviewLabel: teacherReviewMap[item.teacherReviewState],
    previousSubmissionLabel: item.attempt.previousSubmissionId
      ? `${item.attempt.roundLabel} · previous ${item.attempt.previousSubmissionId}`
      : `${item.attempt.roundLabel} · 无 previous submission`,
  };
}
