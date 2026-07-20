import { assessmentTitle } from "./assessment-content";
import {
  cloneReadingMeta,
  createAssessmentReportId,
} from "./assessment-helpers";
import {
  findStoredReport,
  getBrowserLocalStorage,
  listStoredReports,
  type StorageLike,
  upsertStoredReport,
} from "./assessment-storage";
import type {
  AssessmentMode,
  AssessmentReport,
  AssessmentSubmissionInput,
} from "./assessment-types";

export interface AssessmentGateway {
  mode: AssessmentMode;
  submitAssessment(input: AssessmentSubmissionInput): Promise<AssessmentReport>;
  getReport(reportId: string): Promise<AssessmentReport | null>;
  listHistory(): Promise<AssessmentReport[]>;
}

function createLiveReport(input: AssessmentSubmissionInput): AssessmentReport {
  const now = new Date().toISOString();

  return {
    reportId: createAssessmentReportId("live"),
    title: assessmentTitle,
    createdAt: now,
    updatedAt: now,
    mode: "live",
    status: "pending",
    isDemo: false,
    summary:
      "已收到你的朗读录音和书面作答。学生端真实流程目前仅返回提交状态，不会生成 AI 分数。",
    disclaimer:
      "当前真实评测网关只保留 pending / unavailable 状态位，后续需要教师端或服务接通后再查看结果。",
    reading: cloneReadingMeta(input.reading),
    written: {
      totalQuestions: input.totalQuestions,
      answeredQuestions: input.answeredQuestions,
    },
    dimensions: [
      {
        key: "reading",
        label: "朗读表达",
        status: "pending",
        summary: "录音已提交，等待评测服务可用后返回。",
      },
      {
        key: "written",
        label: "书面表达",
        status: "pending",
        summary: `已提交 ${input.answeredQuestions}/${input.totalQuestions} 题，等待评分网关可用后返回。`,
      },
    ],
    highlights: [
      "本次记录已写入历史，不会覆盖你之前的提交。",
      "学生端可继续查看状态变化，但当前不会展示真实 AI 分数。",
    ],
  };
}

function createDemoReport(input: AssessmentSubmissionInput): AssessmentReport {
  const now = new Date().toISOString();
  const completionRatio =
    input.totalQuestions > 0
      ? input.answeredQuestions / input.totalQuestions
      : 0;
  const readingScore = Math.min(
    92,
    Math.max(76, 76 + Math.round(input.reading.durationMs / 4000)),
  );
  const writtenScore = 72 + Math.round(completionRatio * 24);
  const overallScore = Math.round(readingScore * 0.45 + writtenScore * 0.55);

  return {
    reportId: createAssessmentReportId("demo"),
    title: assessmentTitle,
    createdAt: now,
    updatedAt: now,
    mode: "demo",
    status: "complete",
    isDemo: true,
    summary:
      "这是演示报告，用于联调学生端闭环。页面中的分数、点评和建议均为 demo 数据，不代表真实 AI 评测结果。",
    disclaimer:
      "演示报告仅用于产品走查与页面验证，请勿将其中分数用于正式教学判断。",
    reading: cloneReadingMeta(input.reading),
    written: {
      totalQuestions: input.totalQuestions,
      answeredQuestions: input.answeredQuestions,
    },
    dimensions: [
      {
        key: "reading",
        label: "朗读表达",
        status: "complete",
        score: readingScore,
        summary: "演示数据认为你的语速较稳定，停顿控制基本自然。",
      },
      {
        key: "written",
        label: "书面表达",
        status: "complete",
        score: writtenScore,
        summary: "演示数据认为你的信息提取比较完整，表达能覆盖题目重点。",
      },
    ],
    highlights: [
      "演示报告保留了完整闭环，便于联调 loading / complete / history 对比状态。",
      "若继续提交 demo 流程，会生成新的 reportId，并在历史页中保留旧记录。",
      "真实流程默认只显示 pending / unavailable，不会伪造 AI 分数。",
    ],
    overallScore,
  };
}

function createStorageGateway(
  mode: AssessmentMode,
  buildReport: (input: AssessmentSubmissionInput) => AssessmentReport,
  storage = getBrowserLocalStorage(),
): AssessmentGateway {
  return {
    mode,
    async submitAssessment(input) {
      const report = buildReport(input);
      upsertStoredReport(report, storage);
      return report;
    },
    async getReport(reportId) {
      const report = findStoredReport(reportId, storage);

      if (!report || report.mode !== mode) {
        return null;
      }

      return report;
    },
    async listHistory() {
      return listStoredReports(storage).filter(
        (report) => report.mode === mode,
      );
    },
  };
}

export function createLiveAssessmentGateway(storage?: StorageLike | null) {
  return createStorageGateway("live", createLiveReport, storage);
}

export function createDemoAssessmentGateway(storage?: StorageLike | null) {
  return createStorageGateway("demo", createDemoReport, storage);
}

export function resolveAssessmentGateway(
  mode: AssessmentMode,
  storage = getBrowserLocalStorage(),
) {
  return mode === "demo"
    ? createDemoAssessmentGateway(storage)
    : createLiveAssessmentGateway(storage);
}

export async function getAssessmentReport(
  reportId: string,
  storage = getBrowserLocalStorage(),
) {
  const report = findStoredReport(reportId, storage);

  if (!report) {
    return null;
  }

  return resolveAssessmentGateway(report.mode, storage).getReport(reportId);
}

export async function listAssessmentHistory(
  storage = getBrowserLocalStorage(),
) {
  const liveGateway = createLiveAssessmentGateway(storage);
  const demoGateway = createDemoAssessmentGateway(storage);
  const [live, demo] = await Promise.all([
    liveGateway.listHistory(),
    demoGateway.listHistory(),
  ]);

  return [...live, ...demo].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );
}
