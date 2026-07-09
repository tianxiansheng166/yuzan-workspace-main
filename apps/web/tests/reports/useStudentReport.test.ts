import { flushPromises } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { useStudentReport } from "../../app/features/reports/composables/useStudentReport";

describe("useStudentReport composable", () => {
  it("starts in loading state", () => {
    const { state } = useStudentReport();
    expect(state.value.status).toBe("loading");
  });

  it("transitions to ready with demo report", async () => {
    const { state, load } = useStudentReport();

    load("demo-student-001", "demo-school-001");
    await flushPromises();

    expect(state.value.status).toBe("ready");
    expect(state.value.report).not.toBeNull();
    expect(state.value.report?.summary.studentId).toBe("demo-student-001");
  });

  it("handles unavailable state", async () => {
    const { state, load } = useStudentReport();

    load("unavailable", "demo-school-001");
    await flushPromises();

    expect(state.value.status).toBe("unavailable");
    expect(state.value.report).toBeNull();
  });

  it("handles empty state", async () => {
    const { state, load } = useStudentReport();

    load("empty", "demo-school-001");
    await flushPromises();

    expect(state.value.status).toBe("empty");
    expect(state.value.report).toBeNull();
  });
});
