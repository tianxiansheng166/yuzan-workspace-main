import type {
  ConfidenceBand,
  EvidenceKind,
  QueueLane,
  ReviewStatus,
  ReviewSubmissionDetail,
  ReviewSubmissionSummary,
  SyncHealth,
  TeacherChecklistItem,
} from "~/features/submission-review/types";

type StatusTone = "neutral" | "success" | "warning" | "danger" | "information";

export interface ReviewRowViewModel {
  id: string;
  studentName: string;
  className: string;
  assignmentTitle: string;
  laneLabel: string;
  laneTone: StatusTone;
  evidenceLabel: string;
  statusLabel: string;
  statusTone: StatusTone;
  confidenceLabel: string;
  confidenceTone: StatusTone;
  syncLabel: string;
  syncTone: StatusTone;
  submittedAt: string;
  issueSummary: string;
  meta: string;
  isDemo: boolean;
}

export interface ReviewLaneViewModel {
  lane: QueueLane;
  title: string;
  description: string;
  items: ReviewRowViewModel[];
}

export interface ChecklistViewModel extends TeacherChecklistItem {
  tone: StatusTone;
}

export interface ReviewDetailViewModel extends ReviewRowViewModel {
  prompt: string;
  studentResponse: string;
  transcript: string;
  autoSuggestion: string;
  autoRationale: string;
  recommendedOutcomeLabel: string;
  decisionLabel: string;
  modelVersion: string;
  confidenceScore: string;
  teacherDraftNote: string;
  checklist: ChecklistViewModel[];
  artifacts: ReviewSubmissionDetail["artifacts"];
  history: ReviewSubmissionDetail["history"];
}

const laneMap: Record<
  QueueLane,
  { label: string; title: string; description: string; tone: StatusTone }
> = {
  incomplete: {
    label: "未完成 / 需确认",
    title: "未完成或证据缺口",
    description: "先分辨学生漏做、离线未同步，还是原始答案尚未到齐。",
    tone: "warning",
  },
  "low-confidence": {
    label: "低置信度",
    title: "低置信度自动结果",
    description: "教师应结合原始证据确认自动建议，而不是直接照单全收。",
    tone: "information",
  },
  "sync-exception": {
    label: "同步异常",
    title: "同步异常与服务不可用",
    description: "证据链不完整时先排障，避免给学生错误结论。",
    tone: "danger",
  },
};

const evidenceKindMap: Record<EvidenceKind, string> = {
  audio: "朗读录音",
  writing: "书面练习",
  reading: "跟读结果",
};

const reviewStatusMap: Record<
  ReviewStatus,
  { label: string; tone: StatusTone }
> = {
  "needs-review": { label: "待复核", tone: "warning" },
  reviewed: { label: "已复核", tone: "information" },
  returned: { label: "已退回", tone: "danger" },
  accepted: { label: "已接受", tone: "success" },
  unavailable: { label: "不可用", tone: "neutral" },
};

const confidenceMap: Record<
  ConfidenceBand,
  { label: string; tone: StatusTone }
> = {
  low: { label: "低置信度", tone: "danger" },
  medium: { label: "中等置信度", tone: "warning" },
  high: { label: "高置信度", tone: "success" },
  unavailable: { label: "不可用", tone: "neutral" },
};

const syncMap: Record<SyncHealth, { label: string; tone: StatusTone }> = {
  synced: { label: "已同步", tone: "success" },
  pending: { label: "同步中", tone: "warning" },
  failed: { label: "同步失败", tone: "danger" },
  unavailable: { label: "不可用", tone: "neutral" },
};

function adaptReviewRow(item: ReviewSubmissionSummary): ReviewRowViewModel {
  const lane = laneMap[item.lane];
  const status = reviewStatusMap[item.reviewStatus];
  const confidence = confidenceMap[item.confidenceBand];
  const sync = syncMap[item.syncHealth];

  return {
    id: item.id,
    studentName: item.studentName,
    className: item.className,
    assignmentTitle: item.assignmentTitle,
    laneLabel: lane.label,
    laneTone: lane.tone,
    evidenceLabel: evidenceKindMap[item.evidenceKind],
    statusLabel: status.label,
    statusTone: status.tone,
    confidenceLabel: confidence.label,
    confidenceTone: confidence.tone,
    syncLabel: sync.label,
    syncTone: sync.tone,
    submittedAt: item.submittedAt,
    issueSummary: item.issueSummary,
    meta: `${item.className} · ${item.assignmentTitle} · ${item.submittedAt}`,
    isDemo: item.isDemo,
  };
}

export function adaptReviewLanes(
  queue: ReviewSubmissionSummary[],
): ReviewLaneViewModel[] {
  return (Object.keys(laneMap) as QueueLane[]).map((lane) => ({
    lane,
    title: laneMap[lane].title,
    description: laneMap[lane].description,
    items: queue.filter((item) => item.lane === lane).map(adaptReviewRow),
  }));
}

export function adaptReviewDetail(
  submission: ReviewSubmissionDetail,
): ReviewDetailViewModel {
  const row = adaptReviewRow(submission);

  return {
    ...row,
    prompt: submission.prompt,
    studentResponse: submission.studentResponse,
    transcript: submission.transcript,
    autoSuggestion: submission.autoSuggestion,
    autoRationale: submission.autoRationale,
    recommendedOutcomeLabel:
      submission.recommendedOutcome === "accept"
        ? "建议接受"
        : submission.recommendedOutcome === "return"
          ? "建议退回补充"
          : "建议线下辅导 / 排障",
    decisionLabel: submission.teacherDecision,
    modelVersion: submission.modelVersion,
    confidenceScore: submission.confidenceScore,
    teacherDraftNote: submission.teacherDraftNote,
    checklist: submission.checklist.map((item) => ({
      ...item,
      tone:
        item.status === "done"
          ? "success"
          : item.status === "attention"
            ? "warning"
            : "neutral",
    })),
    artifacts: submission.artifacts,
    history: submission.history,
  };
}
