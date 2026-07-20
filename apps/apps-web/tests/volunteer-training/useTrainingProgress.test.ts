import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_QUESTIONS,
  TRAINING_MODULES,
} from "../../app/features/volunteer-training/content";
import { useTrainingProgress } from "../../app/features/volunteer-training/useTrainingProgress";

describe("useTrainingProgress", () => {
  it("starts with empty progress", () => {
    const p = useTrainingProgress(
      ASSESSMENT_QUESTIONS,
      TRAINING_MODULES.length,
    );

    expect(p.progress.value.completedModuleIds).toEqual([]);
    expect(p.progress.value.assessmentAnswers).toEqual({});
    expect(p.completedCount.value).toBe(0);
    expect(p.allModulesCompleted.value).toBe(false);
  });

  it("marks modules as completed", () => {
    const p = useTrainingProgress(
      ASSESSMENT_QUESTIONS,
      TRAINING_MODULES.length,
    );

    p.completeModule("intro");

    expect(p.progress.value.completedModuleIds).toContain("intro");
    expect(p.completedCount.value).toBe(1);
  });

  it("does not duplicate completed modules", () => {
    const p = useTrainingProgress(
      ASSESSMENT_QUESTIONS,
      TRAINING_MODULES.length,
    );

    p.completeModule("intro");
    p.completeModule("intro");

    expect(p.progress.value.completedModuleIds).toEqual(["intro"]);
  });

  it("records answers and computes score", () => {
    const p = useTrainingProgress(
      ASSESSMENT_QUESTIONS,
      TRAINING_MODULES.length,
    );

    p.answerQuestion("q1", 1);
    p.answerQuestion("q2", 1);
    p.answerQuestion("q3", 2);

    expect(p.answeredCount.value).toBe(3);
    expect(p.correctCount.value).toBe(3);
    expect(p.passedAssessment.value).toBe(true);
  });

  it("detects failed assessment", () => {
    const p = useTrainingProgress(
      ASSESSMENT_QUESTIONS,
      TRAINING_MODULES.length,
    );

    p.answerQuestion("q1", 0);
    p.answerQuestion("q2", 1);
    p.answerQuestion("q3", 2);

    expect(p.correctCount.value).toBe(2);
    expect(p.passedAssessment.value).toBe(false);
  });

  it("allows certificate only after all modules and correct answers", () => {
    const p = useTrainingProgress(
      ASSESSMENT_QUESTIONS,
      TRAINING_MODULES.length,
    );

    expect(p.canRequestCertificate.value).toBe(false);

    for (const module of TRAINING_MODULES) {
      p.completeModule(module.id);
    }
    expect(p.canRequestCertificate.value).toBe(false);

    p.answerQuestion("q1", 1);
    p.answerQuestion("q2", 1);
    p.answerQuestion("q3", 2);
    expect(p.canRequestCertificate.value).toBe(true);
  });

  it("tracks certificate request", () => {
    const p = useTrainingProgress(
      ASSESSMENT_QUESTIONS,
      TRAINING_MODULES.length,
    );

    p.requestCertificate();

    expect(p.progress.value.certificateRequested).toBe(true);
  });

  it("resets progress", () => {
    const p = useTrainingProgress(
      ASSESSMENT_QUESTIONS,
      TRAINING_MODULES.length,
    );

    p.completeModule("intro");
    p.answerQuestion("q1", 1);
    p.requestCertificate();
    p.reset();

    expect(p.progress.value.completedModuleIds).toEqual([]);
    expect(p.progress.value.assessmentAnswers).toEqual({});
    expect(p.progress.value.certificateRequested).toBe(false);
  });
});
