import type { Report, StudentGrowthProfile } from "../domain/report.types.js";

export function toReportSummary(r: Report) {
  return {
    id: r.id,
    type: r.type,
    status: r.status,
    periodStart: r.periodStart.toISOString(),
    periodEnd: r.periodEnd.toISOString(),
    dataCompleteness: r.dataCompleteness,
    revision: r.revision,
  };
}

export function toReportDetail(r: Report) {
  return {
    ...toReportSummary(r),
    generatedAt: r.generatedAt?.toISOString() ?? null,
    providerDisclosure: r.providerDisclosure,
    filters: r.filters,
    schoolId: r.schoolId,
    data: r.data,
    createdAt: r.createdAt.toISOString(),
  };
}

export function toStudentGrowthProfileResponse(p: StudentGrowthProfile) {
  return {
    enrollmentId: p.enrollmentId,
    periodStart: p.periodStart.toISOString(),
    periodEnd: p.periodEnd.toISOString(),
    generatedAt: p.generatedAt.toISOString(),
    dataCompleteness: p.dataCompleteness,
    providerDisclosure: p.providerDisclosure,
    data: p.data,
  };
}
