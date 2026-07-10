import { computed, ref } from "vue";
import type {
  Exercise,
  AnswerDraft,
  ExerciseResult,
  AnswerValue,
} from "./types.js";

type Fetcher = typeof $fetch;

export interface UseExerciseOptions {
  readonly schoolId: string;
  readonly assignmentId: string;
  readonly activityId: string;
  readonly fetcher?: Fetcher;
}

export interface UseExerciseReturn {
  readonly exercise: Ref<Exercise | null>;
  readonly loading: Ref<boolean>;
  readonly error: Ref<{ message: string; retryable: boolean } | null>;
  readonly offline: Ref<boolean>;
  readonly draft: Ref<AnswerDraft | null>;
  readonly draftState: Ref<"clean" | "dirty" | "saving" | "saved" | "error">;
  readonly submitState: Ref<"idle" | "submitting" | "error" | "success">;
  readonly result: Ref<ExerciseResult | null>;
  readonly load: () => Promise<void>;
  readonly loadDraft: () => Promise<void>;
  readonly saveDraft: (
    answers: Readonly<Record<string, AnswerValue>>,
  ) => Promise<AnswerDraft | null>;
  readonly submit: (
    answers: Readonly<Record<string, AnswerValue>>,
  ) => Promise<ExerciseResult | null>;
  readonly resetSubmit: () => void;
}

function apiPath(options: UseExerciseOptions, suffix: string): string {
  return `/schools/${options.schoolId}/assessments/assignments/${options.assignmentId}/activities/${options.activityId}${suffix}`;
}

function isNetworkError(err: unknown): boolean {
  return (
    err instanceof TypeError ||
    (typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "NETWORK_ERROR")
  );
}

export function useExercise(options: UseExerciseOptions): UseExerciseReturn {
  const exercise = ref<Exercise | null>(null);
  const loading = ref(false);
  const error = ref<{ message: string; retryable: boolean } | null>(null);
  const offline = ref(false);
  const draft = ref<AnswerDraft | null>(null);
  const draftState = ref<"clean" | "dirty" | "saving" | "saved" | "error">(
    "clean",
  );
  const submitState = ref<"idle" | "submitting" | "error" | "success">("idle");
  const result = ref<ExerciseResult | null>(null);

  const fetcher: Fetcher = options.fetcher ?? $fetch;

  async function load() {
    loading.value = true;
    error.value = null;
    offline.value = false;
    try {
      exercise.value = await fetcher<Exercise>(apiPath(options, ""));
    } catch (err) {
      const message = extractErrorMessage(err);
      offline.value = typeof navigator !== "undefined" && !navigator.onLine;
      error.value = {
        message,
        retryable: isNetworkError(err) || offline.value,
      };
    } finally {
      loading.value = false;
    }
  }

  async function loadDraft() {
    try {
      draft.value = await fetcher<AnswerDraft>(apiPath(options, ":draft"));
    } catch {
      draft.value = null;
    }
  }

  async function saveDraft(
    answers: Readonly<Record<string, AnswerValue>>,
  ): Promise<AnswerDraft | null> {
    draftState.value = "saving";
    try {
      const saved = await fetcher<AnswerDraft>(apiPath(options, ":draft"), {
        method: "PATCH",
        body: { answers },
      });
      draft.value = saved;
      draftState.value = "saved";
      return saved;
    } catch (err) {
      draftState.value = "error";
      return null;
    }
  }

  async function submit(
    answers: Readonly<Record<string, AnswerValue>>,
  ): Promise<ExerciseResult | null> {
    submitState.value = "submitting";
    try {
      const response = await fetcher<ExerciseResult>(
        apiPath(options, ":submit"),
        {
          method: "POST",
          body: { answers },
        },
      );
      result.value = response;
      submitState.value = "success";
      return response;
    } catch (err) {
      const message = extractErrorMessage(err);
      submitState.value = "error";
      error.value = { message, retryable: isNetworkError(err) };
      return null;
    }
  }

  function resetSubmit() {
    submitState.value = "idle";
    error.value = null;
  }

  return {
    exercise,
    loading,
    error,
    offline,
    draft,
    draftState,
    submitState,
    result,
    load,
    loadDraft,
    saveDraft,
    submit,
    resetSubmit,
  };
}

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "data" in err && err.data) {
    const data = err.data as { message?: string; code?: string };
    return data.message ?? data.code ?? "请求失败";
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "请求失败";
}
