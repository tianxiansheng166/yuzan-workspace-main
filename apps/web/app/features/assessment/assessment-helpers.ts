import type {
  AssessmentMode,
  ReadingAttemptMeta,
  WrittenAnswers,
  WrittenQuestion,
} from "./assessment-types";

export function normalizeAssessmentMode(value: unknown): AssessmentMode {
  return value === "demo" ? "demo" : "live";
}

export function createInitialWrittenAnswers(
  questions: WrittenQuestion[],
): WrittenAnswers {
  return Object.fromEntries(
    questions.map((question) => {
      if (question.kind === "fill-blank") {
        return [
          question.id,
          Object.fromEntries(question.blanks.map((blank) => [blank.id, ""])),
        ];
      }

      return [question.id, ""];
    }),
  );
}

export function countAnsweredQuestions(
  questions: WrittenQuestion[],
  answers: WrittenAnswers,
): number {
  return questions.filter((question) => {
    const answer = answers[question.id];

    if (typeof answer === "string") {
      return answer.trim().length > 0;
    }

    if (answer && typeof answer === "object") {
      return Object.values(answer).every((value) => value.trim().length > 0);
    }

    return false;
  }).length;
}

export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function createAssessmentReportId(mode: AssessmentMode): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);

  return `${mode}-${Date.now().toString(36)}-${suffix}`;
}

export function cloneReadingMeta(
  reading: ReadingAttemptMeta,
): ReadingAttemptMeta {
  return JSON.parse(JSON.stringify(reading)) as ReadingAttemptMeta;
}
