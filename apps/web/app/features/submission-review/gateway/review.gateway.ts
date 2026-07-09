import type {
  ReviewRole,
  ReviewSubmissionDetail,
  ReviewSubmissionSummary,
} from "~/features/submission-review/types";

export interface ReviewDashboardResult {
  role: ReviewRole;
  queue: ReviewSubmissionSummary[] | null;
  generatedAt: string;
}

export interface ReviewDetailResult {
  role: ReviewRole;
  submission: ReviewSubmissionDetail | null;
}

export type ReviewDemoMode =
  "default" | "empty" | "error" | "permission" | "unavailable";

const queueSeed: ReviewSubmissionDetail[] = [
  {
    id: "rv-demo-001",
    studentName: "扎西拉姆（demo）",
    className: "三年级一班",
    assignmentTitle: "第三单元朗读测评",
    lane: "low-confidence",
    evidenceKind: "audio",
    reviewStatus: "needs-review",
    confidenceBand: "low",
    syncHealth: "synced",
    submittedAt: "2026-07-09 09:20",
    issueSummary: "自动评分波动较大，重音与停连建议不稳定。",
    isDemo: true,
    prompt: "请朗读《高原的早晨》第一段，并完成两句跟读。",
    studentResponse:
      "学生已提交录音与跟读结果，系统保留原始音频引用、自动转写和置信度标签。",
    transcript: "高原的早晨，风从山谷慢慢吹过。孩子们背着书包走向学校。",
    autoSuggestion:
      "建议教师重点核对节奏停连与第二句尾音，暂不直接向学生展示自动分数。",
    autoRationale:
      "首句停顿稳定，但第二句尾音拖长且自动切词出现偏差，低置信度结果需要人工确认。",
    recommendedOutcome: "accept",
    modelVersion: "demo / pending / speech-v0",
    confidenceScore: "0.46 低置信度",
    teacherDraftNote:
      "先确认第二句尾音是否因环境噪声导致误判，再决定是否退回重录。",
    teacherDecision: "待教师确认",
    artifacts: [
      {
        id: "artifact-audio",
        label: "原始录音",
        status: "available",
        note: "demo 引用，仅用于说明原始证据会与自动结果并列保留。",
      },
      {
        id: "artifact-transcript",
        label: "自动转写",
        status: "available",
        note: "保留切词结果与时间戳，便于逐句复核。",
      },
      {
        id: "artifact-score",
        label: "自动建议",
        status: "pending",
        note: "当前为 demo 建议，不代表教师最终结论。",
      },
    ],
    checklist: [
      {
        id: "raw-evidence",
        label: "原始证据可读",
        status: "done",
        note: "录音引用、转写与题干均可见。",
      },
      {
        id: "confidence",
        label: "低置信度原因已标注",
        status: "done",
        note: "自动建议已提示切词偏差与尾音波动。",
      },
      {
        id: "student-feedback",
        label: "学生反馈可执行",
        status: "attention",
        note: "需要把“尾音拖长”改写成学生可理解表达。",
      },
    ],
    history: [
      {
        id: "history-1",
        actor: "系统",
        action: "进入待复核",
        at: "2026-07-09 09:21",
        detail: "自动结果标记为低置信度，未直接写入最终反馈。",
      },
      {
        id: "history-2",
        actor: "系统",
        action: "保留原始证据",
        at: "2026-07-09 09:20",
        detail: "录音、转写和建议同步展示，便于教师复核差异。",
      },
    ],
  },
  {
    id: "rv-demo-002",
    studentName: "尼玛卓嘎（demo）",
    className: "三年级一班",
    assignmentTitle: "书面练习一：句意匹配",
    lane: "incomplete",
    evidenceKind: "writing",
    reviewStatus: "returned",
    confidenceBand: "medium",
    syncHealth: "pending",
    submittedAt: "2026-07-09 08:54",
    issueSummary: "提交缺少第二题解释，教师需判断是未完成还是同步中断。",
    isDemo: true,
    prompt: "完成句意匹配，并说明为什么选择对应句子。",
    studentResponse: "第一题已完成，第二题说明为空。设备显示曾离线。",
    transcript: "书面练习无音频，保留学生输入与同步状态。",
    autoSuggestion: "建议先核对同步状态，再决定退回补充说明。",
    autoRationale:
      "答案缺失可能由弱网导致，若直接退回会掩盖同步异常，需要教师先看原始提交时间线。",
    recommendedOutcome: "return",
    modelVersion: "demo / pending / writing-v0",
    confidenceScore: "0.61 中等置信度",
    teacherDraftNote:
      "先联系学生确认是否在离线状态下提交，再决定是否退回补写。",
    teacherDecision: "已退回补充说明（demo）",
    artifacts: [
      {
        id: "artifact-answer",
        label: "原始答案",
        status: "available",
        note: "保留学生输入与空白字段，不自动补齐。",
      },
      {
        id: "artifact-sync",
        label: "同步状态",
        status: "pending",
        note: "仍待 CUR/OFF 相关任务接入真实同步明细。",
      },
    ],
    checklist: [
      {
        id: "completion",
        label: "未完成原因可解释",
        status: "attention",
        note: "需区分学生漏写与离线同步中断。",
      },
      {
        id: "return-copy",
        label: "退回理由清晰",
        status: "done",
        note: "需明确补写哪一题、补写到什么程度。",
      },
    ],
    history: [
      {
        id: "history-3",
        actor: "教师",
        action: "退回补充",
        at: "2026-07-09 09:02",
        detail: "要求学生补充第二题解释；当前仅为 demo/pending 记录。",
      },
      {
        id: "history-4",
        actor: "系统",
        action: "检测到同步延迟",
        at: "2026-07-09 08:55",
        detail: "本地提交完成，但服务端确认仍为 pending。",
      },
    ],
  },
  {
    id: "rv-demo-003",
    studentName: "曲珍旺姆（demo）",
    className: "三年级二班",
    assignmentTitle: "课后跟读：问候语",
    lane: "sync-exception",
    evidenceKind: "reading",
    reviewStatus: "unavailable",
    confidenceBand: "unavailable",
    syncHealth: "failed",
    submittedAt: "2026-07-08 17:36",
    issueSummary:
      "本地回执存在，但原始结果尚未完成上行，需人工排障而非直接评分。",
    isDemo: true,
    prompt: "完成两句问候语跟读，并确认上传。",
    studentResponse: "设备显示已提交，但当前只拿到本地回执。",
    transcript: "服务暂不可用，暂无可复核转写。",
    autoSuggestion: "先标记为需线下辅导/排障，不向学生发出确定性结果。",
    autoRationale:
      "原始证据未完整到达，任何评分或退回都可能误导学生，需要先恢复证据链。",
    recommendedOutcome: "offline-support",
    modelVersion: "unavailable",
    confidenceScore: "不可用",
    teacherDraftNote: "联系设备管理员排查同步失败，必要时安排线下补录。",
    teacherDecision: "等待排障",
    artifacts: [
      {
        id: "artifact-receipt",
        label: "本地回执",
        status: "available",
        note: "证明学生端已完成本地提交。",
      },
      {
        id: "artifact-audio-missing",
        label: "服务端音频",
        status: "unavailable",
        note: "当前不可用，不能据此给出最终评价。",
      },
    ],
    checklist: [
      {
        id: "sync-exception",
        label: "同步异常已升级",
        status: "done",
        note: "需要同步链路恢复后再继续复核。",
      },
      {
        id: "student-impact",
        label: "学生端提示不误导",
        status: "attention",
        note: "应显示 unavailable，而不是误称“已评分”。",
      },
    ],
    history: [
      {
        id: "history-5",
        actor: "系统",
        action: "同步失败",
        at: "2026-07-08 17:40",
        detail: "服务端未收到完整证据，转入排障队列。",
      },
    ],
  },
];

function delay(ms = 240) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cloneQueue(): ReviewSubmissionDetail[] {
  return queueSeed.map((item) => ({
    ...item,
    artifacts: item.artifacts.map((artifact) => ({ ...artifact })),
    checklist: item.checklist.map((entry) => ({ ...entry })),
    history: item.history.map((entry) => ({ ...entry })),
  }));
}

export async function fetchReviewDashboard(
  mode: ReviewDemoMode = "default",
): Promise<ReviewDashboardResult> {
  await delay();

  if (mode === "error") {
    throw new Error("Failed to load submission review queue");
  }

  if (mode === "permission") {
    return {
      role: "observer",
      queue: cloneQueue(),
      generatedAt: "2026-07-09 09:30",
    };
  }

  if (mode === "unavailable") {
    return {
      role: "teacher",
      queue: null,
      generatedAt: "2026-07-09 09:30",
    };
  }

  return {
    role: "teacher",
    queue: mode === "empty" ? [] : cloneQueue(),
    generatedAt: "2026-07-09 09:30",
  };
}

export async function fetchReviewDetail(
  reviewId: string,
  mode: ReviewDemoMode = "default",
): Promise<ReviewDetailResult> {
  await delay();

  if (mode === "error" || reviewId === "rv-error") {
    throw new Error("Failed to load review detail");
  }

  if (mode === "permission") {
    return {
      role: "observer",
      submission: cloneQueue().find((item) => item.id === reviewId) ?? null,
    };
  }

  if (mode === "unavailable" || reviewId === "rv-unavailable") {
    return {
      role: "teacher",
      submission: null,
    };
  }

  const submission =
    cloneQueue().find((item) => item.id === reviewId) ??
    (mode === "empty" || reviewId === "rv-empty"
      ? null
      : (cloneQueue()[0] ?? null));

  return {
    role: "teacher",
    submission,
  };
}
