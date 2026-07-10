import { describe, expect, it } from "vitest";
import { createReportGateway } from "../../app/features/reports/gateways/report.gateway";

describe("report gateway", () => {
  const gateway = createReportGateway();

  it("lists demo students with explicit demo notice", async () => {
    const result = await gateway.listStudents("demo-school-001");

    expect(result.status).toBe("ready");
    expect(result.students.length).toBeGreaterThan(0);
    expect(result.message).toContain("演示");
    expect(result.students[0]?.displayName).toContain("演示");
  });

  it("returns a ready demo report with growth timeline, comparison and evidence", async () => {
    const result = await gateway.fetchStudentReport(
      "demo-school-001",
      "demo-student-001",
    );

    expect(result.status).toBe("ready");
    expect(result.report).not.toBeNull();
    expect(result.report?.demoNotice).toContain("演示数据");
    expect(result.report?.timeline.length).toBeGreaterThan(0);
    expect(result.report?.comparisons.length).toBeGreaterThan(0);
    expect(result.report?.evidenceSections.length).toBe(3);
    expect(result.report?.intervention.disclaimer).toContain("不构成医疗诊断");
  });

  it("marks AI-driven comparison as pending when not connected", async () => {
    const result = await gateway.fetchStudentReport(
      "demo-school-001",
      "demo-student-001",
    );

    const aiComparison = result.report?.comparisons.find((c) =>
      c.domain.includes("AI"),
    );
    expect(aiComparison?.firstScore).toBeNull();
    expect(aiComparison?.retestScore).toBeNull();
    expect(aiComparison?.changeText).toContain("pending");
  });

  it.each([
    ["empty", "empty"],
    ["error", "error"],
    ["permission", "permission"],
    ["unavailable", "unavailable"],
  ] as const)(
    "returns %s status for studentId '%s'",
    async (expectedStatus, studentId) => {
      const result = await gateway.fetchStudentReport(
        "demo-school-001",
        studentId,
      );
      expect(result.status).toBe(expectedStatus);
      expect(result.report).toBeNull();
    },
  );

  it("does not generate random scores", async () => {
    const first = await gateway.fetchStudentReport(
      "demo-school-001",
      "demo-student-001",
    );
    const second = await gateway.fetchStudentReport(
      "demo-school-001",
      "demo-student-001",
    );

    expect(first.report?.comparisons[0]?.firstScore).toBe(
      second.report?.comparisons[0]?.firstScore,
    );
  });
});
