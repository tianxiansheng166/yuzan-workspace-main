export type ReportType = "STUDENT_GROWTH" | "CLASS_SUMMARY" | "SCHOOL_OVERVIEW";
export type ReportStatus = "PENDING" | "GENERATING" | "READY" | "FAILED";

export interface Report {
  readonly id: string;
  readonly schoolId: string;
  readonly type: ReportType;
  readonly status: ReportStatus;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly filters: Record<string, unknown> | null;
  readonly dataCompleteness: number;
  readonly providerDisclosure: string;
  readonly generatedAt: Date | null;
  readonly generatedByUserId: string | null;
  readonly enrollmentId: string | null;
  readonly classId: string | null;
  readonly data: Record<string, unknown> | null;
  readonly revision: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface StudentGrowthProfile {
  readonly enrollmentId: string;
  readonly schoolId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly generatedAt: Date;
  readonly dataCompleteness: number;
  readonly providerDisclosure: string;
  readonly data: Record<string, unknown>;
}
