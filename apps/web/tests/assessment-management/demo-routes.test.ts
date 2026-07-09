import { beforeEach, describe, expect, it } from "vitest";

import {
  assessmentManagementGateway,
  resetAssessmentManagementDemoState,
} from "../../app/features/assessment-management/gateway";

describe("assessment management demo direct links", () => {
  beforeEach(() => {
    resetAssessmentManagementDemoState();
  });

  it("returns demo task detail for taskId 'demo' without throwing", async () => {
    const detail =
      await assessmentManagementGateway.getAssessmentTaskDetail("demo");

    expect(detail).not.toBeNull();
    expect(detail?.task.id).toBeTruthy();
    expect(detail?.readingMaterial.title).toContain("朗读材料");
    expect(detail?.writingTask.title).toContain("书面任务");
  });

  it("shows demo progress labels and disabled QR reason in task detail", async () => {
    const detail =
      await assessmentManagementGateway.getAssessmentTaskDetail("demo");

    expect(detail?.task.progress.completedLabel).toBe("demo");
    expect(detail?.task.progress.incompleteLabel).toBe("unavailable");
    expect(detail?.task.demoLink.qrAvailable).toBe(false);
    expect(detail?.task.demoLink.qrReason).toContain("依赖批准");
  });

  it("returns demo student reports for studentId 'demo' without throwing", async () => {
    const data =
      await assessmentManagementGateway.getStudentAssessmentReports("demo");

    expect(data).not.toBeNull();
    expect(data?.report.studentId).toBe("student-lobsang");
    expect(data?.report.studentName).toBe("洛桑");
    expect(data?.relatedTasks.length).toBeGreaterThan(0);
  });
});
