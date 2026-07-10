export type ReportDataStatus =
  "loading" | "ready" | "empty" | "error" | "permission" | "unavailable";

export type InterventionLevel = "none" | "observe" | "practice" | "teacher";

export interface StudentReportSummary {
  studentId: string;
  displayName: string;
  schoolId: string;
  className: string;
  lastAssessedAt: string | null;
  overallStatus: "pending" | "available" | "unavailable";
}

export interface GrowthEvent {
  id: string;
  occurredAt: string;
  kind:
    | "initial_assessment"
    | "reassessment"
    | "course_completed"
    | "intervention_started"
    | "intervention_reviewed";
  label: string;
  note: string;
  /** 仅当数据可用时提供；null 表示 pending/unavailable */
  scoreDelta: number | null;
}

export interface TestComparison {
  domain: string;
  firstScore: number | null;
  retestScore: number | null;
  firstAt: string | null;
  retestAt: string | null;
  changeText: string | null;
}

export interface EvidenceItem {
  id: string;
  title: string;
  recordedAt: string;
  kind: string;
  availability: "pending" | "available" | "unavailable";
  /** 结构化摘要，供表格/文本替代使用 */
  summary: string;
  /** 原始证据引用；null 表示未接入真实存储 */
  assetUrl: string | null;
}

export interface EvidenceSection {
  kind: "reading" | "writing" | "course";
  label: string;
  items: EvidenceItem[];
}

export interface InterventionSuggestion {
  level: InterventionLevel;
  title: string;
  description: string;
  /** 明确标记为教学观察建议，非医疗或正式诊断 */
  disclaimer: string;
  actions: string[];
}

export interface StudentGrowthReport {
  summary: StudentReportSummary;
  timeline: GrowthEvent[];
  comparisons: TestComparison[];
  evidenceSections: EvidenceSection[];
  intervention: InterventionSuggestion;
  demoNotice: string | null;
}

export interface ReportsListResult {
  status: Exclude<ReportDataStatus, "loading">;
  students: StudentReportSummary[];
  message: string;
}

export interface StudentReportResult {
  status: Exclude<ReportDataStatus, "loading">;
  report: StudentGrowthReport | null;
  message: string;
}
