import type { AssessmentReport } from "../domain/assessment.types.js";

export const ASSESSMENT_REPORT_REPOSITORY = Symbol("ASSESSMENT_REPORT_REPOSITORY");

export interface CreateAssessmentReportData {
  readonly sessionId: string;
  readonly schoolId: string;
  readonly overallScore?: number;
  readonly readingScore?: number;
  readonly writtenScore?: number;
  readonly summary?: Record<string, unknown>;
  readonly recommendations?: Record<string, unknown>;
  readonly dataCompleteness?: number;
  readonly generatedByUserId?: string;
}

export interface AssessmentReportRepositoryPort {
  findBySessionId(sessionId: string): Promise<AssessmentReport | null>;
  create(data: CreateAssessmentReportData): Promise<AssessmentReport>;
}
