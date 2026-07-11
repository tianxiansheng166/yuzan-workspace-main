import type { AssessmentDimensionResult, AssessmentReportStatus } from "./assessment-types";

export interface AssessmentReportViewModel {
  status: AssessmentReportStatus;
  overallScore: number | null;
  dimensions: AssessmentDimensionResult[];
  weakPoints: string[];
  recommendations: string[];
  provisional: boolean;
  reviewRequired: boolean;
  analysisUnavailable: boolean;
  providerDisclosure: string | null;
}

const knownLabels: Record<string, string> = {
  reading: "朗读表现",
  written: "书面练习",
  pronunciation: "发音准确度",
  fluency: "朗读流畅度",
};

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const textList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

function normalizeDimension(value: unknown, fallbackKey: string): AssessmentDimensionResult {
  const source = record(value) ?? {};
  const key = typeof source.key === "string" ? source.key : fallbackKey;
  const score = typeof source.score === "number" && Number.isFinite(source.score)
    ? Math.max(0, Math.min(100, source.score))
    : undefined;
  const rawStatus = source.status;
  const status: AssessmentReportStatus = rawStatus === "complete" || rawStatus === "unavailable"
    ? rawStatus
    : "pending";
  return {
    key: key === "reading" ? "reading" : "written",
    label: typeof source.label === "string" ? source.label : knownLabels[key] ?? `其他维度：${key}`,
    status,
    summary: typeof source.summary === "string" ? source.summary : "该维度暂无可展示的分析结果。",
    ...(score === undefined ? {} : { score }),
  };
}

export function normalizeAssessmentReport(input: unknown): AssessmentReportViewModel {
  const source = record(input) ?? {};
  const rawDimensions = source.dimensions;
  const dimensions = Array.isArray(rawDimensions)
    ? rawDimensions.map((item, index) => normalizeDimension(item, `unknown-${index + 1}`))
    : Object.entries(record(rawDimensions) ?? {}).map(([key, value]) =>
        normalizeDimension(value, key),
      );
  const overallScore = typeof source.overallScore === "number" && Number.isFinite(source.overallScore)
    ? Math.max(0, Math.min(100, source.overallScore))
    : null;
  const analysisUnavailable = source.analysisUnavailable === true;
  const provisional = source.provisional === true;
  const reviewRequired = source.reviewRequired === true;
  return {
    status: analysisUnavailable
      ? "unavailable"
      : source.status === "complete" && !provisional
        ? "complete"
        : "pending",
    overallScore,
    dimensions,
    weakPoints: textList(source.weakPoints),
    recommendations: analysisUnavailable ? [] : textList(source.recommendations),
    provisional,
    reviewRequired,
    analysisUnavailable,
    providerDisclosure: typeof source.providerDisclosure === "string" ? source.providerDisclosure : null,
  };
}
