import { describe, it, expect, beforeEach, vi } from "vitest";
import { useExercise } from "~/features/exercises/index.js";
import { exerciseFixture } from "./fixtures.js";

describe("useExercise", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", { onLine: true });
  });

  it("loads exercise and tracks loading state", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(exerciseFixture);
    const { exercise, loading, load } = useExercise({
      schoolId: "school-a",
      assignmentId: "asn-1",
      activityId: "act-1",
      fetcher: fetcher as unknown as typeof $fetch,
    });

    expect(loading.value).toBe(false);
    const promise = load();
    expect(loading.value).toBe(true);
    await promise;
    expect(loading.value).toBe(false);
    expect(exercise.value).toEqual(exerciseFixture);
    expect(fetcher).toHaveBeenCalledWith(
      "/schools/school-a/assessments/assignments/asn-1/activities/act-1",
    );
  });

  it("sets retryable error on network failure", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { error, offline, load } = useExercise({
      schoolId: "school-a",
      assignmentId: "asn-1",
      activityId: "act-1",
      fetcher: fetcher as unknown as typeof $fetch,
    });

    await load();
    expect(error.value?.message).toBe("Failed to fetch");
    expect(error.value?.retryable).toBe(true);
    expect(offline.value).toBe(false);
  });

  it("detects offline state from navigator", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("offline"));
    const { error, offline, load } = useExercise({
      schoolId: "school-a",
      assignmentId: "asn-1",
      activityId: "act-1",
      fetcher: fetcher as unknown as typeof $fetch,
    });

    await load();
    expect(offline.value).toBe(true);
    expect(error.value?.retryable).toBe(true);
  });

  it("saves draft via PATCH", async () => {
    const draft = {
      draftId: "draft-1",
      assignmentId: "asn-1",
      activityId: "act-1",
      answers: { "q-single": { kind: "SINGLE_CHOICE", optionId: "opt-a" } },
      updatedAt: "2026-07-10T00:00:00Z",
    };
    const fetcher = vi.fn().mockResolvedValueOnce(draft);
    const { saveDraft, draftState } = useExercise({
      schoolId: "school-a",
      assignmentId: "asn-1",
      activityId: "act-1",
      fetcher: fetcher as unknown as typeof $fetch,
    });

    const result = await saveDraft(draft.answers);
    expect(draftState.value).toBe("saved");
    expect(result).toEqual(draft);
    expect(fetcher).toHaveBeenCalledWith(
      "/schools/school-a/assessments/assignments/asn-1/activities/act-1:draft",
      { method: "PATCH", body: { answers: draft.answers } },
    );
  });

  it("submits answers via POST", async () => {
    const resultFixture = {
      attemptId: "att-1",
      assignmentId: "asn-1",
      activityId: "act-1",
      attemptNo: 1,
      status: "GRADED",
      answers: { "q-single": { kind: "SINGLE_CHOICE", optionId: "opt-a" } },
      autoResult: { score: 1, maxScore: 1, details: [] },
      questions: [],
      answerKeyVisible: true,
      submittedAt: "2026-07-10T00:00:00Z",
    };
    const fetcher = vi.fn().mockResolvedValueOnce(resultFixture);
    const { submit, submitState, result } = useExercise({
      schoolId: "school-a",
      assignmentId: "asn-1",
      activityId: "act-1",
      fetcher: fetcher as unknown as typeof $fetch,
    });

    const response = await submit(resultFixture.answers);
    expect(submitState.value).toBe("success");
    expect(result.value).toEqual(resultFixture);
    expect(response).toEqual(resultFixture);
    expect(fetcher).toHaveBeenCalledWith(
      "/schools/school-a/assessments/assignments/asn-1/activities/act-1:submit",
      { method: "POST", body: { answers: resultFixture.answers } },
    );
  });

  it("extracts server error message from response data", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce({
      data: { code: "ASSESSMENT_CONFLICT", message: "尝试次数已达上限" },
    });
    const { submit, submitState, error } = useExercise({
      schoolId: "school-a",
      assignmentId: "asn-1",
      activityId: "act-1",
      fetcher: fetcher as unknown as typeof $fetch,
    });

    await submit({});
    expect(submitState.value).toBe("error");
    expect(error.value?.message).toBe("尝试次数已达上限");
  });
});
