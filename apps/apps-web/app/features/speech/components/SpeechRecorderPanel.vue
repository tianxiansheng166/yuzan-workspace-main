<script setup lang="ts">
import { computed } from "vue";
import { useSpeechRecorder } from "../composables/useSpeechRecorder";

const { controller, snapshot, quality, previewUrl, refresh } =
  useSpeechRecorder();
const elapsed = computed(
  () => `${Math.floor(snapshot.value.elapsedMs / 1000)} 秒`,
);

async function run(action: () => void | Promise<void>) {
  await action();
  refresh();
}
</script>

<template>
  <section class="speech-recorder" aria-labelledby="speech-recorder-title">
    <header class="speech-recorder__header">
      <p class="speech-recorder__eyebrow">本地朗读录音</p>
      <h2 id="speech-recorder-title">先确认设备，再开始朗读</h2>
      <p>
        麦克风只用于采集本次朗读。默认不自动上传、不自动提交，也不会生成发音分数或诊断。
      </p>
    </header>

    <div class="speech-recorder__status" role="status" aria-live="polite">
      <strong>当前状态：{{ snapshot.state }}</strong>
      <span>{{ snapshot.message }}</span>
      <span aria-label="本次录音时长">时长：{{ elapsed }}</span>
      <span>同步：{{ snapshot.syncState }}</span>
    </div>

    <div class="speech-recorder__actions" aria-label="录音操作">
      <button type="button" @click="run(() => controller.requestPermission())">
        允许使用麦克风
      </button>
      <button type="button" @click="run(() => controller.checkInput())">
        检查输入
      </button>
      <button
        class="speech-recorder__record"
        type="button"
        @click="run(() => controller.start())"
      >
        开始录音
      </button>
      <button
        type="button"
        aria-label="暂停录音"
        @click="run(() => controller.pause())"
      >
        暂停
      </button>
      <button
        type="button"
        aria-label="继续录音"
        @click="run(() => controller.resume())"
      >
        继续
      </button>
      <button
        type="button"
        aria-label="停止录音并进入本地试听"
        @click="run(() => controller.stop())"
      >
        停止
      </button>
    </div>

    <div v-if="previewUrl" class="speech-recorder__review">
      <h3>本地试听与设备质检</h3>
      <audio :src="previewUrl" controls preload="metadata">
        浏览器不支持本地音频试听。
      </audio>
      <ul v-if="quality">
        <li v-for="check in quality.checks" :key="check.code">
          {{ check.message }}
        </li>
      </ul>
      <p>这些提示只检查设备和音频信号，不评价发音、口音或学习能力。</p>
    </div>

    <div class="speech-recorder__actions speech-recorder__actions--final">
      <button type="button" @click="run(() => controller.saveLocal())">
        保存为 local-only
      </button>
      <button
        type="button"
        @click="run(() => controller.markUploadUnavailable())"
      >
        查看上传状态
      </button>
      <button type="button" @click="run(() => controller.retake())">
        重新录制
      </button>
      <button
        class="speech-recorder__delete"
        type="button"
        aria-label="删除本地录音"
        @click="run(() => controller.deleteLocal())"
      >
        删除本地录音
      </button>
    </div>

    <p class="speech-recorder__boundary">
      本地保存不等于上传或提交。上传与提交当前
      unavailable，安全退出前请确认状态为 local-only。
    </p>
  </section>
</template>

<style scoped>
.speech-recorder {
  max-width: 52rem;
  padding: clamp(1rem, 4vw, 2rem);
  border: 1px solid var(--yx-color-line);
  border-left: 0.4rem solid var(--yx-color-sage-strong);
  background:
    repeating-radial-gradient(
      ellipse at 0 0,
      transparent 0 1.35rem,
      color-mix(in srgb, var(--yx-color-line) 28%, transparent) 1.4rem 1.45rem
    ),
    var(--yx-color-paper);
  color: var(--yx-color-ink);
}
.speech-recorder__header h2 {
  margin: 0.35rem 0 0.75rem;
}
.speech-recorder__header p,
.speech-recorder__boundary {
  line-height: 1.7;
  color: var(--yx-color-ink-soft);
}
.speech-recorder__eyebrow {
  margin: 0;
  font-weight: 700;
  letter-spacing: 0.08em;
}
.speech-recorder__status {
  display: grid;
  gap: 0.4rem;
  margin-block: 1.5rem;
  padding-block: 1rem;
  border-block: 1px solid var(--yx-color-line);
}
.speech-recorder__status strong {
  font-size: clamp(1.2rem, 4vw, 1.75rem);
}
.speech-recorder__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}
.speech-recorder button {
  min-height: 2.75rem;
  min-width: 2.75rem;
  padding: 0.65rem 1rem;
  border: 1px solid currentColor;
  border-radius: 0.35rem;
  background: var(--yx-color-paper);
  color: var(--yx-color-ink);
  font: inherit;
  font-weight: 700;
}
.speech-recorder button:focus-visible {
  outline: 3px solid var(--yx-color-sage-strong);
  outline-offset: 3px;
}
.speech-recorder__record {
  background: var(--yx-color-sage-strong) !important;
  color: var(--yx-color-paper) !important;
}
.speech-recorder__delete {
  color: var(--yx-color-danger, #8a2f25) !important;
}
.speech-recorder__review {
  margin-block: 1.5rem;
}
.speech-recorder__review audio {
  width: 100%;
}
.speech-recorder__review li {
  margin-block: 0.45rem;
  line-height: 1.6;
}
.speech-recorder__actions--final {
  padding-top: 1rem;
  border-top: 1px solid var(--yx-color-line);
}
@media (max-width: 24.375rem) {
  .speech-recorder {
    padding: 1rem;
  }
  .speech-recorder__actions {
    display: grid;
    grid-template-columns: 1fr;
  }
}
@media (prefers-reduced-motion: reduce) {
  .speech-recorder *,
  .speech-recorder *::before,
  .speech-recorder *::after {
    scroll-behavior: auto !important;
    transition: none !important;
    animation: none !important;
  }
}
</style>
