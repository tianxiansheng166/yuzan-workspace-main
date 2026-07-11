import type { Report, ReportType, ReportStatus } from "../domain/report.types.js";

export interface ListReportsOptions {
  limit?: number;
  cursor?: string;
  type?: ReportType;
  status?: ReportStatus;
}

export interface CreateReportData {
  schoolId: string;
  type: ReportType;
  periodStart: Date;
  periodEnd: Date;
  filters?: Record<string, unknown>;
  enrollmentId?: string;
  classId?: string;
  generatedByUserId: string;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export const REPORT_REPOSITORY = Symbol("REPORT_REPOSITORY");

export interface ReportRepositoryPort {
  findById(schoolId: string, reportId: string): Promise<Report | null>;
  list(schoolId: string, options: ListReportsOptions): Promise<PaginatedResult<Report>>;
  create(data: CreateReportData): Promise<Report>;
  updateStatus(schoolId: string, reportId: string, status: ReportStatus, data?: Partial<Report>): Promise<Report>;
}
