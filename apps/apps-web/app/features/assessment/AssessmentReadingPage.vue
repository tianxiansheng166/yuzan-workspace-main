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
import { useRecordingUpload } from "../speech/composables/useRecordingUpload.js";
import { useSpeechResult } from "../speech/composables/useSpeechResult.js";
import { recordingGateway } from "../speech/gateways/recording.gateway.js";

type CaptureState =
  | "idle"
  | "requesting"
  | "recording"
  | "recorded"
  | "uploading"
  | "uploaded"
  | "scoring"
  | "scored"
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
const uploadProgress = ref(0);

// 录音上传 composable
const { state: uploadState, init: initUpload, uploadBlob, complete: completeUpload, reset: resetUpload } = useRecordingUpload();
// 语音评分结果 composable
const { jobStatus, isLoading: isScoring, error: scoringError, startPolling, stopPolling, reset: resetScoring } = useSpeechResult();

let mediaRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let recordingStartedAt = 0;
let timerId: number | null = null;
let chunks: BlobPart[] = [];
let lastBlob: Blob | null = null;

useHead({
  title: `${assessmentTitle} - 朗读 | 语赞心声`,
});

const modeLabel = computed(() =>
  mode.value === "demo" ? "演示流程" : "真实流程",
);
const statusTone = computed(() => {
  if (captureState.value === "scored" || captureState.value === "uploaded") {
    return "success";
  }

  if (
    captureState.value === "permission-denied" ||
    captureState.value === "unsupported" ||
    captureState.value === "error"
  ) {
    return "danger";
  }

  if (captureState.value === "recording" || captureState.value === "uploading" || captureState.value === "scoring") {
    return "warning";
  }

  return "neutral";
});

// 评分结果计算属性
const scoreResult = computed(() => {
  if (jobStatus.value?.result) {
    return jobStatus.value.result;
  }
  return null;
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
  lastBlob = null;
  durationMs.value = 0;
  recordingStartedAt = 0;
  errorMessage.value = "";
  uploadProgress.value = 0;
  revokeAudioUrl();
  captureState.value = "idle";
  statusMessage.value = "准备好后开始录音。";
  resetUpload();
  resetScoring();

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
      lastBlob = blob;
      revokeAudioUrl();
      audioUrl.value = URL.createObjectURL(blob);
      captureState.value = "recorded";
      statusMessage.value = "录音已完成，可以试听、重录或提交录音。";
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

/**
 * 提交录音到后端
 */
async function submitRecording() {
  if (!lastBlob || captureState.value !== "recorded") return;

  captureState.value = "uploading";
  statusMessage.value = "正在初始化录音上传...";
  errorMessage.value = "";

  try {
    // 设置认证信息（从 localStorage 获取）
    const storedAuth = import.meta.client ? localStorage.getItem("auth") : null;
    if (storedAuth) {
      try {
        const authData = JSON.parse(storedAuth);
        if (authData.schoolId && authData.accessToken) {
          recordingGateway.setAuth(authData.schoolId, authData.accessToken);
        }
      } catch { /* ignore parse error */ }
    }

    // 1. 初始化录音（获取预签名 URL）
    // 需要从路由或存储获取 enrollmentId
    const enrollmentId = (route.query.enrollmentId as string) || "demo-enrollment";
    const initResult = await initUpload({
      enrollmentId,
      mimeType: lastBlob.type || "audio/webm",
    });

    if (!initResult) {
      captureState.value = "error";
      errorMessage.value = "录音初始化失败，请重试。";
      statusMessage.value = errorMessage.value;
      return;
    }

    statusMessage.value = "正在上传录音...";

    // 2. 上传 Blob 到预签名 URL
    const uploadOk = await uploadBlob(lastBlob, lastBlob.type || "audio/webm");
    if (!uploadOk) {
      captureState.value = "error";
      errorMessage.value = "录音上传失败，请重试。";
      statusMessage.value = errorMessage.value;
      return;
    }

    statusMessage.value = "正在确认录音...";

    // 3. 完成录音（服务端验证文件存在）
    const recordingId = await completeUpload(durationMs.value);
    if (!recordingId) {
      captureState.value = "error";
      errorMessage.value = "录音确认失败，请重试。";
      statusMessage.value = errorMessage.value;
      return;
    }

    captureState.value = "uploaded";
    statusMessage.value = "录音已成功上传并确认。";
    saveReadingAttemptMeta({
      startedAt: new Date(recordingStartedAt).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: durationMs.value,
      mimeType: lastBlob.type || "audio/webm",
      promptTitle: assessmentReadingPrompt.title,
    });

    // 4. 如果有 sessionId 和 itemId，尝试触发评分
    const sessionId = route.query.sessionId as string;
    const itemId = route.query.itemId as string;
    if (sessionId && itemId && recordingId) {
      // 绑定录音到测评项
      try {
        await recordingGateway.attachRecordingToItem(sessionId, itemId, recordingId);
      } catch { /* non-fatal */ }
    }
  } catch (error: unknown) {
    captureState.value = "error";
    errorMessage.value = error instanceof Error ? error.message : "提交录音失败";
    statusMessage.value = errorMessage.value;
  }
}

async function continueToWritten() {
  if (captureState.value !== "recorded" && captureState.value !== "uploaded" && captureState.value !== "scored") {
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

// 同步上传进度
watch(() => uploadState.value.progress, (p) => {
  uploadProgress.value = p;
});

onBeforeUnmount(() => {
  clearTimer();
  stopTracks();
  revokeAudioUrl();
  stopPolling();
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
        :class="{ 'reading-card--recording': captureState === 'recording' }"
        tabindex="-1"
        :aria-live="captureState === 'recording' ? 'polite' : 'assertive'"
      >
        <div class="reading-card__meta">
          <YxStatus :tone="statusTone">{{ statusMessage }}</YxStatus>
          <p class="reading-timer">{{ formatDuration(durationMs) }}</p>
        </div>

        <div class="reading-soundfield" aria-hidden="true">
          <span v-for="bar in 13" :key="bar" />
        </div>

        <p v-if="errorMessage" class="reading-error" role="alert">
          {{ errorMessage }}
        </p>

        <div class="reading-actions">
          <YxButton
            kind="primary"
            :loading="captureState === 'requesting'"
            :disabled="captureState === 'recording' || captureState === 'uploading'"
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
            :loading="captureState === 'uploading'"
            :disabled="captureState !== 'recorded'"
            @click="submitRecording"
          >
            {{ captureState === 'uploading' ? `上传中 ${uploadProgress}%` : '提交录音' }}
          </YxButton>
          <YxButton
            kind="secondary"
            :disabled="captureState !== 'uploaded' && captureState !== 'scored'"
            @click="continueToWritten"
          >
            进入书面作答
          </YxButton>
        </div>

        <div v-if="audioUrl" class="reading-preview">
          <p class="reading-preview__label">录音试听</p>
          <audio :src="audioUrl" controls preload="metadata" />
        </div>

        <!-- 评分结果展示 -->
        <div v-if="scoreResult" class="reading-scores">
          <p class="reading-scores__label">自动评分结果</p>
          <div class="reading-scores__grid">
            <div class="reading-scores__item">
              <span class="reading-scores__dim">准确度</span>
              <span class="reading-scores__val">{{ scoreResult.scores.accuracy }}</span>
            </div>
            <div class="reading-scores__item">
              <span class="reading-scores__dim">完整度</span>
              <span class="reading-scores__val">{{ scoreResult.scores.completeness }}</span>
            </div>
            <div class="reading-scores__item">
              <span class="reading-scores__dim">流利度</span>
              <span class="reading-scores__val">{{ scoreResult.scores.fluency }}</span>
            </div>
            <div class="reading-scores__item">
              <span class="reading-scores__dim">声调</span>
              <span class="reading-scores__val">{{ scoreResult.scores.tone }}</span>
            </div>
            <div class="reading-scores__item reading-scores__item--overall">
              <span class="reading-scores__dim">总分</span>
              <span class="reading-scores__val">{{ scoreResult.scores.overall }}</span>
            </div>
          </div>
          <p v-if="scoreResult.transcript" class="reading-scores__transcript">
            识别文本：{{ scoreResult.transcript }}
          </p>
          <p v-if="scoreResult.requiresReview" class="reading-scores__review">
            ⚠️ 自动评分置信度较低，需要教师复核。
          </p>
        </div>

        <p class="reading-hint">
          如果权限被拒绝，请先在浏览器地址栏重新允许麦克风，再点击"开始录音"。
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
  border-radius: 0.75rem;
  background: var(--yx-surface-default);
  box-shadow: none;
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
  position: relative;
  overflow: hidden;
  background: color-mix(in srgb, var(--yx-surface-default) 92%, #667868);
}

.reading-card--controls::after {
  content: "";
  position: absolute;
  inset: auto -10% -5rem 42%;
  height: 10rem;
  border-top: 1px solid rgb(83 122 120 / 18%);
  border-radius: 50%;
  transform: rotate(-8deg);
  pointer-events: none;
}

.reading-card--recording {
  border-color: #b74735;
  box-shadow: 0 0 0 0.35rem rgb(183 71 53 / 10%);
}

.reading-soundfield {
  display: flex;
  align-items: center;
  gap: 0.32rem;
  min-height: 3.25rem;
  padding: 0.75rem 1rem;
  border-block: 1px solid rgb(83 122 120 / 20%);
  background: rgb(83 122 120 / 5%);
}

.reading-soundfield span {
  flex: 1;
  height: 0.35rem;
  max-width: 0.35rem;
  border-radius: 999px;
  background: #537a78;
  opacity: 0.5;
  transform-origin: center;
}

.reading-card--recording .reading-soundfield span {
  animation: reading-wave 520ms ease-in-out infinite alternate;
  opacity: 0.9;
}

.reading-card--recording .reading-soundfield span:nth-child(2n) {
  height: 1.4rem;
}

.reading-card--recording .reading-soundfield span:nth-child(3n) {
  height: 2rem;
}

@keyframes reading-wave {
  to { transform: scaleY(0.35); }
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

/* 评分结果 */
.reading-scores {
  display: grid;
  gap: var(--yx-space-400);
  padding: var(--yx-space-500);
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  background: var(--yx-surface-default);
}

.reading-scores__label {
  margin: 0;
  font-weight: var(--yx-font-weight-semibold);
  color: var(--yx-text-accent);
}

.reading-scores__grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--yx-space-300);
  text-align: center;
}

.reading-scores__item {
  display: grid;
  gap: var(--yx-space-100);
  padding: var(--yx-space-300);
  border-radius: var(--yx-radius-md);
  background: var(--yx-bg-muted);
}

.reading-scores__item--overall {
  background: color-mix(in srgb, var(--yx-surface-default) 85%, #4a90d9);
}

.reading-scores__dim {
  font-size: var(--yx-font-size-200);
  color: var(--yx-text-secondary);
}

.reading-scores__val {
  font-family: var(--yx-font-display);
  font-size: clamp(1.25rem, 3vw, 1.75rem);
  font-weight: var(--yx-font-weight-bold);
}

.reading-scores__transcript {
  margin: 0;
  color: var(--yx-text-secondary);
  font-size: var(--yx-font-size-300);
}

.reading-scores__review {
  margin: 0;
  padding: var(--yx-space-200) var(--yx-space-300);
  border-radius: var(--yx-radius-md);
  background: color-mix(in srgb, var(--yx-surface-default) 90%, #d4a030);
  color: #8b6914;
  font-size: var(--yx-font-size-300);
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

@media (prefers-reduced-motion: reduce) {
  .reading-card--recording .reading-soundfield span {
    animation: none;
  }
}
</style>
