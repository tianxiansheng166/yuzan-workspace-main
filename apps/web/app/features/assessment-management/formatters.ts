import type { AssessmentTaskStatus, StudentReportStatus } from "./types";

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function formatTaskStatus(status: AssessmentTaskStatus) {
  if (status === "live") {
    return "进行中";
  }

  if (status === "scheduled") {
    return "待开放";
  }

  return "已停用";
}

export function formatStudentReportStatus(status: StudentReportStatus) {
  if (status === "ready") {
    return "报告可查看";
  }

  if (status === "in_progress") {
    return "报告生成中";
  }

  return "报告暂不可用";
}
