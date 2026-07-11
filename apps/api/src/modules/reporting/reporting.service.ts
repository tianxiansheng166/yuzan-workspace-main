import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import type { CreateReportData, ListReportsOptions, ReportRepositoryPort } from "./ports/report-repository.port.js";
import { REPORT_REPOSITORY } from "./ports/report-repository.port.js";
import { ReportForbiddenException, ReportNotFoundException } from "./domain/report.errors.js";
import { ReportingPolicy } from "./reporting.policy.js";
import { toReportDetailResponse, toReportSummaryResponse, toStudentGrowthProfileResponse } from "./dto/report-response.js";

@Injectable()
export class ReportingService {
  private readonly policy = new ReportingPolicy();

  constructor(
    @Inject(REPORT_REPOSITORY)
    private readonly reportRepo: ReportRepositoryPort,
  ) {}

  async listReports(auth: AuthContext, schoolId: string, options: ListReportsOptions) {
    if (!this.policy.canListReports(auth, schoolId)) {
      throw new ReportForbiddenException();
    }
    const result = await this.reportRepo.list(schoolId, options);
    return {
      items: result.items.map(toReportSummaryResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async createReport(auth: AuthContext, schoolId: string, data: Omit<CreateReportData, "schoolId" | "generatedByUserId">) {
    if (!this.policy.canCreateReport(auth, schoolId)) {
      throw new ReportForbiddenException();
    }
    const report = await this.reportRepo.create({
      ...data,
      schoolId,
      generatedByUserId: auth.principal.userId,
    });
    return toReportSummaryResponse(report);
  }

  async getReport(auth: AuthContext, schoolId: string, reportId: string) {
    if (!this.policy.canReadReport(auth, schoolId)) {
      throw new ReportForbiddenException();
    }
    const report = await this.reportRepo.findById(schoolId, reportId);
    if (!report) {
      throw new ReportNotFoundException();
    }
    return toReportDetailResponse(report);
  }

  async getStudentGrowthProfile(auth: AuthContext, schoolId: string, enrollmentId: string) {
    if (!this.policy.canReadReport(auth, schoolId)) {
      throw new ReportForbiddenException();
    }
    // Find or generate student growth report
    const result = await this.reportRepo.list(schoolId, {
      type: "STUDENT_GROWTH",
      limit: 1,
    });
    const report = result.items[0];
    if (!report) {
      throw new ReportNotFoundException("学生成长档案尚未生成");
    }
    return toStudentGrowthProfileResponse({
      enrollmentId: report.enrollmentId ?? enrollmentId,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      generatedAt: report.generatedAt ?? report.createdAt,
      dataCompleteness: report.dataCompleteness,
      providerDisclosure: report.providerDisclosure,
      data: report.data ?? {},
    });
  }
}
