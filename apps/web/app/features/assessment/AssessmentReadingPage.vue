<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";

import { YxButton, YxStatus } from "@yuzan/ui";

import AssessmentPageShell from "./AssessmentPageShell.vue";
import { assessmentReadingPrompt, assessmentTitle } from "./assessment-content";
import { formatDuration, normalizeAssessmentMode } from "./assessment-helpers";
import {
  clearReadingAttemptMeta,
  saveReadingAttemptMeta,
} from "./assessment-storage";

type CaptureState =
  | "idle"
  | "requesting"
  | "recording"
  | "recorded"
  | "permission-denied"
  | "unsupported"
  | "error";

const route = useRoute();
const mode = computed(() => normalizeAssessmentMode(route.query.mode));
const captureState = ref<CaptureState>("idle");
const statusMessage = ref("准备好后开始录音。");
const errorMessage = ref("");
const audioUrl = ref("");
const durationMs = ref(0);
const statusRef = ref<HTMLElement | null>(null);

let mediaRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let recordingStartedAt = 0;
let timerId: number | null = null;
let chunks: BlobPart[] = [];

useHead({
  title: `${assessmentTitle} - 朗读 | 语赞心声`,
});

const modeLabel = computed(() =>
  mode.value === "demo" ? "演示流程" : "真实流程",
);
const statusTone = computed(() => {
  if (captureState.value === "recorded") {
    return "success";
  }

  if (
    captureState.value === "permission-denied" ||
    captureState.value === "unsupported" ||
    captureState.value === "error"
  ) {
    return "danger";
  }

  if (captureState.value === "recording") {
    return "warning";
  }

  return "neutral";
});

function clearTimer() {
  if (timerId !== null && import.meta.client) {
    window.clearInterval(timerId);
  }

  timerId = null;
}

function stopTracks() {
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
}

function revokeAudioUrl() {
  if (audioUrl.value && import.meta.client) {
    URL.revokeObjectURL(audioUrl.value);
  }

  audioUrl.value = "";
}

function resetRecording(clearPersisted = true) {
  clearTimer();
  stopTracks();
  mediaRecorder = null;
  chunks = [];
  durationMs.value = 0;
  recordingStartedAt = 0;
  errorMessage.value = "";
  revokeAudioUrl();
  captureState.value = "idle";
  statusMessage.value = "准备好后开始录音。";

  if (clearPersisted) {
    clearReadingAttemptMeta();
  }
}

function focusStatusCard() {
  void nextTick(() => statusRef.value?.focus());
}

async function startRecording() {
  if (!import.meta.client) {
    return;
  }

  if (
    !navigator.mediaDevices?.getUserMedia ||
    typeof MediaRecorder === "undefined"
  ) {
    resetRecording();
    captureState.value = "unsupported";
    statusMessage.value =
      "当前浏览器不支持录音，请更换到支持 MediaRecorder 的浏览器。";
    focusStatusCard();
    return;
  }

  resetRecording();
  captureState.value = "requesting";
  statusMessage.value = "正在请求麦克风权限。";

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(mediaStream);
    chunks = [];
    recordingStartedAt = Date.now();
    durationMs.value = 0;
    captureState.value = "recording";
    statusMessage.value = "录音中，请保持自然语速与完整表达。";

    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    });

    mediaRecorder.addEventListener("stop", () => {
      const completedAt = new Date().toISOString();
      const finalDuration = Math.max(
        durationMs.value,
        Date.now() - recordingStartedAt,
      );
      const mimeType = mediaRecorder?.mimeType || "audio/webm";

      clearTimer();
      stopTracks();
      durationMs.value = finalDuration;

      if (!chunks.length) {
        captureState.value = "error";
        errorMessage.value = "录音未生成音频数据，请重试。";
        statusMessage.value = errorMessage.value;
        focusStatusCard();
        return;
      }

      const blob = new Blob(chunks, {
        type: mimeType,
      });
      revokeAudioUrl();
      audioUrl.value = URL.createObjectURL(blob);
      captureState.value = "recorded";
      statusMessage.value = "录音已完成，可以试听、重录或进入书面作答。";
      saveReadingAttemptMeta({
        startedAt: new Date(recordingStartedAt).toISOString(),
        completedAt,
        durationMs: finalDuration,
        mimeType: blob.type || mimeType,
        promptTitle: assessmentReadingPrompt.title,
      });
      focusStatusCard();
    });

    mediaRecorder.start();
    timerId = window.setInterval(() => {
      durationMs.value = Date.now() - recordingStartedAt;
    }, 250);
  } catch (error) {
    stopTracks();
    captureState.value =
      error instanceof DOMException && error.name === "NotAllowedError"
        ? "permission-denied"
        : "error";
    errorMessage.value =
      captureState.value === "permission-denied"
        ? "你拒绝了麦克风权限，请在浏览器设置中允许录音后再试。"
        : "录音启动失败，请检查浏览器权限或设备状态。";
    statusMessage.value = errorMessage.value;
    focusStatusCard();
  }
}

function stopRecording() {
  if (mediaRecorder?.state === "recording") {
    mediaRecorder.stop();
  }
}

async function continueToWritten() {
  if (captureState.value !== "recorded") {
    return;
  }

  await navigateTo({
    path: "/assessment/written",
    query: mode.value === "demo" ? { mode: "demo" } : {},
  });
}

watch(captureState, (value) => {
  if (
    value === "permission-denied" ||
    value === "unsupported" ||
    value === "error"
  ) {
    focusStatusCard();
  }
});

onBeforeUnmount(() => {
  clearTimer();
  stopTracks();
  revokeAudioUrl();
});
</script>

<template>
  <AssessmentPageShell
    :title="`${assessmentTitle} · 朗读`"
    :summary="assessmentReadingPrompt.summary"
    :mode="mode"
    :mode-label="modeLabel"
  >
    <template #actions>
      <NuxtLink class="text-link" to="/assessment">返回测评首页</NuxtLink>
      <NuxtLink class="text-link" to="/assessment/history">历史记录</NuxtLink>
    </template>

    <div class="reading-layout">
      <section class="reading-card">
        <p class="reading-card__label">朗读材料</p>
        <h2>{{ assessmentReadingPrompt.title }}</h2>
        <div class="reading-copy">
          <p
            v-for="paragraph in assessmentReadingPrompt.paragraphs"
            :key="paragraph"
          >
            {{ paragraph }}
          </p>
        </div>
      </section>

      <section
        ref="statusRef"
        class="reading-card reading-card--controls"
        tabindex="-1"
        :aria-live="captureState === 'recording' ? 'polite' : 'assertive'"
      >
        <div class="reading-card__meta">
          <YxStatus :tone="statusTone">{{ statusMessage }}</YxStatus>
          <p class="reading-timer">{{ formatDuration(durationMs) }}</p>
        </div>

        <p v-if="errorMessage" class="reading-error" role="alert">
          {{ errorMessage }}
        </p>

        <div class="reading-actions">
          <YxButton
            kind="primary"
            :loading="captureState === 'requesting'"
            :disabled="captureState === 'recording'"
            @click="startRecording"
          >
            开始录音
          </YxButton>
          <YxButton
            kind="secondary"
            :disabled="captureState !== 'recording'"
            @click="stopRecording"
          >
            停止录音
          </YxButton>
          <YxButton
            kind="secondary"
            :disabled="captureState !== 'recorded' && captureState !== 'error'"
            @click="resetRecording"
          >
            重录
          </YxButton>
          <YxButton
            kind="primary"
            :disabled="captureState !== 'recorded'"
            @click="continueToWritten"
          >
            进入书面作答
          </YxButton>
        </div>

        <div v-if="audioUrl" class="reading-preview">
          <p class="reading-preview__label">录音试听</p>
          <audio :src="audioUrl" controls preload="metadata" />
        </div>

        <p class="reading-hint">
          如果权限被拒绝，请先在浏览器地址栏重新允许麦克风，再点击“开始录音”。
        </p>
      </section>
    </div>

    <template #aside>
      <section class="reading-side">
        <h2>本页要求</h2>
        <ul>
          <li>必须完成真实录音后才能进入下一步。</li>
          <li>支持试听与重录，新的录音不会覆盖历史报告。</li>
          <li>真实流程后续只显示 pending / unavailable，不会制造 AI 分数。</li>
        </ul>
      </section>
    </template>
  </AssessmentPageShell>
</template>

<style scoped>
.reading-layout {
  display: grid;
  gap: var(--yx-space-600);
}

.reading-card,
.reading-side {
  padding: clamp(1.2rem, 3vw, 1.8rem);
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-lg);
  background: var(--yx-surface-default);
  box-shadow: var(--yx-shadow-100);
}

.reading-card__label {
  margin: 0;
  color: var(--yx-text-accent);
  font-weight: var(--yx-font-weight-semibold);
}

.reading-card h2,
.reading-side h2 {
  margin: var(--yx-space-300) 0 0;
  font-size: var(--yx-font-size-600);
}

.reading-copy {
  display: grid;
  gap: var(--yx-space-400);
  margin-top: var(--yx-space-500);
  color: var(--yx-text-secondary);
  line-height: var(--yx-line-height-relaxed);
}

.reading-card--controls {
  display: grid;
  gap: var(--yx-space-500);
}

.reading-card__meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--yx-space-400);
  flex-wrap: wrap;
}

.reading-timer {
  margin: 0;
  font-family: var(--yx-font-display);
  font-size: clamp(1.5rem, 4vw, 2.25rem);
  line-height: 1;
}

.reading-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--yx-space-300);
}

.reading-preview {
  display: grid;
  gap: var(--yx-space-200);
  padding: var(--yx-space-400);
  border-radius: var(--yx-radius-md);
  background: var(--yx-bg-muted);
}

.reading-preview__label,
.reading-hint,
.reading-error {
  margin: 0;
}

.reading-error {
  color: var(--yx-danger-fg);
}

.reading-hint,
.reading-side ul {
  color: var(--yx-text-secondary);
}

.reading-side ul {
  margin: var(--yx-space-400) 0 0;
  padding-left: 1.1rem;
}

.reading-side li + li {
  margin-top: var(--yx-space-300);
}

.text-link {
  color: var(--yx-action-link);
  text-decoration-thickness: 0.08em;
}

@media (max-width: 48rem) {
  .reading-actions {
    flex-direction: column;
  }

  .reading-actions :deep(button) {
    width: 100%;
  }
}
</style>
