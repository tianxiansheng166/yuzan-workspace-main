import { beforeEach, describe, expect, it } from "vitest";

import {
  assessmentManagementGateway,
  parsePreviewState,
  resetAssessmentManagementDemoState,
} from "../../app/features/assessment-management/gateway";

describe("assessmentManagementGateway", () => {
  beforeEach(() => {
    resetAssessmentManagementDemoState();
  });

  it("parses preview state with complete as fallback", () => {
    expect(parsePreviewState("loading")).toBe("loading");
    expect(parsePreviewState("empty")).toBe("empty");
    expect(parsePreviewState("error")).toBe("error");
    expect(parsePreviewState("other")).toBe("complete");
    expect(parsePreviewState(undefined)).toBe("complete");
  });

  it("creates a demo task with a unique access link", async () => {
    const task = await assessmentManagementGateway.createAssessmentTask({
      title: "  七月测试任务  ",
      readingMaterialId: "reading-snowline",
      writingTaskId: "writing-letter",
      opensAt: "2026-07-11T08:00",
      closesAt: "2026-07-16T18:00",
      targetIds: ["class-grade6-b2", "student-lobsang"],
      anonymous: true,
    });

    expect(task.title).toBe("七月测试任务");
    expect(task.id).toMatch(/^assessment-demo-/);
    expect(task.demoLink.url).toContain(task.id);
    expect(task.progress.completedLabel).toBe("demo");
    expect(task.progress.incompleteLabel).toBe("unavailable");

    const dashboard = await assessmentManagementGateway.getDashboardData();
    expect(dashboard.tasks[0]?.id).toBe(task.id);
  });

  it("returns detail data with linked materials and reports", async () => {
    const detail = await assessmentManagementGateway.getAssessmentTaskDetail(
      "assessment-demo-summer-speaking",
    );

    expect(detail).not.toBeNull();
    expect(detail?.readingMaterial.title).toContain("朗读材料");
    expect(detail?.writingTask.title).toContain("书面任务");
    expect(detail?.reports).toHaveLength(3);
  });

  it("deactivates an existing demo task", async () => {
    const task = await assessmentManagementGateway.deactivateAssessmentTask(
      "assessment-demo-summer-speaking",
    );

    expect(task.status).toBe("inactive");
    expect(task.demoLink.deactivatedAt).toBeTruthy();
  });

  it("supports empty and error demo states", async () => {
    const emptyDashboard =
      await assessmentManagementGateway.getDashboardData("empty");
    expect(emptyDashboard.tasks).toHaveLength(0);

    await expect(
      assessmentManagementGateway.getStudentAssessmentReports(
        "student-lobsang",
        "error",
      ),
    ).rejects.toThrow(/demo unavailable/i);
  });
});
