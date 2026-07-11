import type { Report, StudentGrowthProfile } from "../domain/report.types.js";

export function toReportSummaryResponse(report: Report) {
  return {
    id: report.id,
    type: report.type,
    status: report.status,
    periodStart: report.periodStart.toISOString(),
    periodEnd: report.periodEnd.toISOString(),
    dataCompleteness: report.dataCompleteness,
    revision: report.revision,
  };
}

export function toReportDetailResponse(report: Report) {
  return {
    ...toReportSummaryResponse(report),
    generatedAt: report.generatedAt?.toISOString() ?? null,
    providerDisclosure: report.providerDisclosure,
    filters: report.filters,
    schoolId: report.schoolId,
    data: report.data,
    createdAt: report.createdAt.toISOString(),
  };
}

export function toStudentGrowthProfileResponse(profile: StudentGrowthProfile) {
  return {
    enrollmentId: profile.enrollmentId,
    periodStart: profile.periodStart.toISOString(),
    periodEnd: profile.periodEnd.toISOString(),
    generatedAt: profile.generatedAt.toISOString(),
    dataCompleteness: profile.dataCompleteness,
    providerDisclosure: profile.providerDisclosure,
    data: profile.data,
  };
}
