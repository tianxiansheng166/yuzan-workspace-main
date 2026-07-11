import { describe, expect, it } from "vitest";
import { createWaitingTeacherCoreAdapter, WAITING_BACKEND } from "../../app/features/teacher/core-adapter";
import { createWaitingStudentCoursesAdapter } from "../../app/features/student-courses/core-adapter";
describe("B31-101 typed adapters", () => {
  it("does not pretend unbound teacher writes succeeded", async () => {
    const result = await createWaitingTeacherCoreAdapter().saveFeedback({ submissionId: "s", body: "review", isDirty: true });
    expect(result).toMatchObject({ status: WAITING_BACKEND, capability: "feedback" });
  });
  it("does not manufacture student courses or recommendations", async () => {
    expect(await createWaitingStudentCoursesAdapter().listCourses()).toMatchObject({ status: WAITING_BACKEND, capability: "learning" });
  });
});
