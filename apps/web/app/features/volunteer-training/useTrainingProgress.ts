import { computed, ref, watch } from "vue";
import type { AssessmentQuestion, TrainingProgress } from "./types";

const STORAGE_KEY = "yuzan:volunteer-training-progress";

export function useTrainingProgress(
  questions: AssessmentQuestion[],
  moduleCount: number,
) {
  const progress = ref<TrainingProgress>({
    completedModuleIds: [],
    assessmentAnswers: {},
    certificateRequested: false,
  });

  const loaded = ref(false);

  function load() {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        progress.value = JSON.parse(raw) as TrainingProgress;
      }
    } catch {
      progress.value = {
        completedModuleIds: [],
        assessmentAnswers: {},
        certificateRequested: false,
      };
    }
    loaded.value = true;
  }

  function persist() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress.value));
    } catch {
      // localStorage 不可用时静默失败。
    }
  }

  function completeModule(moduleId: string) {
    if (!progress.value.completedModuleIds.includes(moduleId)) {
      progress.value.completedModuleIds.push(moduleId);
    }
  }

  function answerQuestion(questionId: string, optionIndex: number) {
    progress.value.assessmentAnswers[questionId] = optionIndex;
  }

  function requestCertificate() {
    progress.value.certificateRequested = true;
  }

  function reset() {
    progress.value = {
      completedModuleIds: [],
      assessmentAnswers: {},
      certificateRequested: false,
    };
  }

  const completedCount = computed(
    () => progress.value.completedModuleIds.length,
  );

  const allModulesCompleted = computed(
    () => completedCount.value >= moduleCount,
  );

  const answeredCount = computed(
    () => Object.keys(progress.value.assessmentAnswers).length,
  );

  const allQuestionsAnswered = computed(
    () => answeredCount.value >= questions.length,
  );

  const correctCount = computed(() => {
    return questions.reduce((count, question) => {
      const answer = progress.value.assessmentAnswers[question.id];
      return answer === question.correctIndex ? count + 1 : count;
    }, 0);
  });

  const passedAssessment = computed(
    () => allQuestionsAnswered.value && correctCount.value === questions.length,
  );

  const canRequestCertificate = computed(
    () => allModulesCompleted.value && passedAssessment.value,
  );

  watch(progress, persist, { deep: true });

  return {
    progress,
    loaded,
    load,
    completeModule,
    answerQuestion,
    requestCertificate,
    reset,
    completedCount,
    allModulesCompleted,
    answeredCount,
    allQuestionsAnswered,
    correctCount,
    passedAssessment,
    canRequestCertificate,
  };
}
