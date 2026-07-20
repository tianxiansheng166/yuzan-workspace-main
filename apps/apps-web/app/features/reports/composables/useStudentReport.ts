import { ref } from "vue";
import type { ReportDataStatus, StudentGrowthReport } from "../types";
import { reportGateway } from "../gateways/report.gateway";

export interface UseStudentReportState {
  status: ReportDataStatus;
  report: StudentGrowthReport | null;
  message: string;
}

export function useStudentReport() {
  const state = ref<UseStudentReportState>({
    status: "loading",
    report: null,
    message: "",
  });

  async function load(studentId: string, schoolId: string) {
    state.value = {
      status: "loading",
      report: null,
      message: "正在读取学生成长报告……",
    };

    try {
      const result = await reportGateway.fetchStudentReport(
        schoolId,
        studentId,
      );
      state.value = {
        status: result.status === "ready" ? "ready" : result.status,
        report: result.report,
        message: result.message,
      };
    } catch {
      state.value = {
        status: "error",
        report: null,
        message: "读取报告时发生未知错误，请稍后重试。",
      };
    }
  }

  return {
    state,
    load,
  };
}
