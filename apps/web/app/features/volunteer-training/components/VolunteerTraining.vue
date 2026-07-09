<script setup lang="ts">
import { ref } from "vue";
import { YxButton, YxStatus } from "@yuzan/ui";
import {
  ASSESSMENT_QUESTIONS,
  TRAINING_MATERIALS,
  TRAINING_MODULES,
} from "../content";
import { useTrainingProgress } from "../useTrainingProgress";
import TrainingAssessment from "./TrainingAssessment.vue";
import TrainingModule from "./TrainingModule.vue";

const feedback = ref<{
  message: string;
  tone: "success" | "warning" | "information";
} | null>(null);

const {
  progress,
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
} = useTrainingProgress(ASSESSMENT_QUESTIONS, TRAINING_MODULES.length);

function showFeedback(
  message: string,
  tone: "success" | "warning" | "information",
) {
  feedback.value = { message, tone };
  window.setTimeout(() => {
    feedback.value = null;
  }, 3000);
}

function handleCompleteModule(moduleId: string) {
  completeModule(moduleId);
  showFeedback("课程已标记完成", "success");
}

function handleAnswer(questionId: string, optionIndex: number) {
  answerQuestion(questionId, optionIndex);
  showFeedback("答案已保存", "success");
}

function handleRequestCertificate() {
  requestCertificate();
  showFeedback("证书申请已记录，证书功能接入后将通知你", "information");
}

function handleDownload(materialId: string) {
  showFeedback(`资料“${materialId}”下载待接入`, "warning");
}

function handleReset() {
  reset();
  showFeedback("进度已重置", "information");
}

load();
</script>

<template>
  <div class="volunteer-training">
    <header class="volunteer-training__header">
      <div>
        <h1 class="volunteer-training__title">志愿者培训</h1>
        <p class="volunteer-training__lead">
          完成全部课程与考核后，即可申请培训证书。
        </p>
      </div>
      <div class="volunteer-training__summary">
        <YxStatus tone="information" data-testid="module-progress"
          >课程 {{ completedCount }}/{{ TRAINING_MODULES.length }}</YxStatus
        >
        <YxStatus tone="information" data-testid="question-progress"
          >考核 {{ answeredCount }}/{{ ASSESSMENT_QUESTIONS.length }}</YxStatus
        >
        <YxStatus
          v-if="passedAssessment"
          tone="success"
          data-testid="assessment-passed"
          >考核通过 {{ correctCount }}/{{
            ASSESSMENT_QUESTIONS.length
          }}</YxStatus
        >
      </div>
    </header>

    <div
      v-if="feedback"
      class="volunteer-training__feedback"
      :data-tone="feedback.tone"
      role="status"
      data-testid="training-feedback"
    >
      {{ feedback.message }}
    </div>

    <section aria-labelledby="modules-title">
      <h2 id="modules-title" class="volunteer-training__section-title">
        培训课程
      </h2>
      <div class="volunteer-training__modules">
        <TrainingModule
          v-for="module in TRAINING_MODULES"
          :key="module.id"
          :module="module"
          :completed="progress.completedModuleIds.includes(module.id)"
          @complete="handleCompleteModule"
        />
      </div>
    </section>

    <section
      class="volunteer-training__materials"
      aria-labelledby="materials-title"
    >
      <h2 id="materials-title" class="volunteer-training__section-title">
        培训资料
      </h2>
      <ul class="volunteer-training__material-list">
        <li
          v-for="material in TRAINING_MATERIALS"
          :key="material.id"
          class="volunteer-training__material"
        >
          <span>
            <strong>{{ material.title }}</strong>
            <span class="volunteer-training__material-size">
              {{ material.size }}
            </span>
          </span>
          <YxButton
            kind="secondary"
            data-testid="download-material"
            @click="handleDownload(material.title)"
          >
            下载
          </YxButton>
        </li>
      </ul>
    </section>

    <TrainingAssessment
      :questions="ASSESSMENT_QUESTIONS"
      :answers="progress.assessmentAnswers"
      @answer="handleAnswer"
    />

    <section
      class="volunteer-training__certificate"
      aria-labelledby="certificate-title"
    >
      <h2 id="certificate-title" class="volunteer-training__section-title">
        培训证书
      </h2>
      <div
        v-if="!canRequestCertificate"
        class="volunteer-training__certificate-hint"
      >
        完成全部课程与考核后可申请证书。
      </div>
      <div v-else class="volunteer-training__certificate-ready">
        <YxButton
          data-testid="request-certificate"
          :disabled="progress.certificateRequested"
          @click="handleRequestCertificate"
        >
          {{ progress.certificateRequested ? "已申请" : "申请证书" }}
        </YxButton>
        <p
          v-if="progress.certificateRequested"
          class="volunteer-training__certificate-note"
        >
          证书功能待接入，申请已记录在本地。
        </p>
      </div>
    </section>

    <div class="volunteer-training__reset">
      <YxButton kind="quiet" data-testid="reset-progress" @click="handleReset">
        重置本地进度
      </YxButton>
    </div>
  </div>
</template>

<style scoped>
.volunteer-training {
  padding-block: var(--yx-space-800);
}

.volunteer-training__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--yx-space-400);
  margin-bottom: var(--yx-space-600);
  flex-wrap: wrap;
}

.volunteer-training__title {
  margin: 0;
  font: var(--yx-font-size-600) / var(--yx-line-height-tight)
    var(--yx-font-display);
}

.volunteer-training__lead {
  margin: var(--yx-space-200) 0 0;
  color: var(--yx-text-secondary);
}

.volunteer-training__summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--yx-space-300);
}

.volunteer-training__feedback {
  margin-bottom: var(--yx-space-600);
  padding: var(--yx-space-400);
  border-radius: var(--yx-radius-md);
  font-weight: var(--yx-font-weight-medium);
}

.volunteer-training__feedback[data-tone="success"] {
  background: var(--yx-success-bg);
  color: var(--yx-success-fg);
}

.volunteer-training__feedback[data-tone="warning"] {
  background: var(--yx-warning-bg);
  color: var(--yx-warning-fg);
}

.volunteer-training__feedback[data-tone="information"] {
  background: var(--yx-information-bg);
  color: var(--yx-information-fg);
}

.volunteer-training__section-title {
  margin: var(--yx-space-800) 0 var(--yx-space-400);
  font: var(--yx-font-size-400) / var(--yx-line-height-tight)
    var(--yx-font-display);
}

.volunteer-training__modules {
  display: grid;
  gap: var(--yx-space-400);
}

.volunteer-training__material-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--yx-space-300);
}

.volunteer-training__material {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--yx-space-400);
  padding: var(--yx-space-400);
  background: var(--yx-surface-raised);
  border-radius: var(--yx-radius-md);
  flex-wrap: wrap;
}

.volunteer-training__material-size {
  margin-left: var(--yx-space-200);
  font-size: var(--yx-font-size-200);
  color: var(--yx-text-muted);
}

.volunteer-training__certificate {
  margin-top: var(--yx-space-800);
  padding: var(--yx-space-500);
  background: var(--yx-surface-raised);
  border-radius: var(--yx-radius-lg);
}

.volunteer-training__certificate-hint {
  color: var(--yx-text-muted);
}

.volunteer-training__certificate-ready {
  display: grid;
  gap: var(--yx-space-300);
}

.volunteer-training__certificate-note {
  margin: 0;
  font-size: var(--yx-font-size-200);
  color: var(--yx-text-muted);
}

.volunteer-training__reset {
  margin-top: var(--yx-space-600);
}
</style>
