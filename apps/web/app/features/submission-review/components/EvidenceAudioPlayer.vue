<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";

const props = withDefaults(defineProps<{
  src?: string | null;
  anchors?: Array<{ id: string; label: string; at: number }>;
  providerUnavailable?: boolean;
}>(), { src: null, anchors: () => [], providerUnavailable: false });

const audio = ref<HTMLAudioElement | null>(null);
const currentTime = ref(0);
const duration = ref(0);
const state = ref<"idle" | "loading" | "playing" | "paused" | "buffering" | "ended" | "error">("idle");
const speed = ref(1);
const available = computed(() => Boolean(props.src) && !props.providerUnavailable);
const progress = computed(() => duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0);
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;

async function toggle() {
  if (!audio.value || !available.value) return;
  if (audio.value.paused) await audio.value.play(); else audio.value.pause();
}
function seek(value: number) {
  if (!audio.value || !Number.isFinite(value)) return;
  audio.value.currentTime = Math.max(0, Math.min(value, duration.value || value));
}
function updateSpeed(value: string) {
  speed.value = Number(value);
  if (audio.value) audio.value.playbackRate = speed.value;
}
function cleanup() {
  audio.value?.pause();
  if (audio.value) audio.value.removeAttribute("src");
}
onBeforeUnmount(cleanup);
</script>

<template>
  <section class="evidence-player" aria-label="教师证据播放器" @keydown.space.prevent="toggle" @keydown.left.prevent="seek(currentTime - 5)" @keydown.right.prevent="seek(currentTime + 5)">
    <div v-if="!available" class="evidence-player__empty" role="status">
      <strong>{{ providerUnavailable ? "音频服务暂不可用" : "暂无可播放的证据音频" }}</strong>
      <span>播放器不会模拟时长、波形或播放进度。</span>
    </div>
    <template v-else>
      <audio ref="audio" :src="src || undefined" preload="metadata" @loadstart="state = 'loading'" @loadedmetadata="duration = audio?.duration || 0; state = 'paused'" @timeupdate="currentTime = audio?.currentTime || 0" @playing="state = 'playing'" @pause="state = 'paused'" @waiting="state = 'buffering'" @ended="state = 'ended'" @error="state = 'error'" />
      <div class="evidence-player__controls">
        <button type="button" :aria-label="state === 'playing' ? '暂停证据音频' : '播放证据音频'" @click="toggle">{{ state === "playing" ? "暂停" : "播放" }}</button>
        <label><span class="sr-only">播放进度</span><input type="range" min="0" :max="duration || 0" step="0.1" :value="currentTime" :style="{ '--progress': `${progress}%` }" @input="seek(Number(($event.target as HTMLInputElement).value))"></label>
        <output aria-live="off">{{ clock(currentTime) }} / {{ clock(duration) }}</output>
        <label>速度<select :value="speed" @change="updateSpeed(($event.target as HTMLSelectElement).value)"><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select></label>
      </div>
      <p class="evidence-player__state" aria-live="polite">{{ state }}</p>
      <div v-if="anchors.length" class="evidence-player__anchors" aria-label="问题片段与教师批注锚点">
        <button v-for="anchor in anchors" :key="anchor.id" type="button" @click="seek(anchor.at)">{{ clock(anchor.at) }} · {{ anchor.label }}</button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.evidence-player { padding: 1rem; border: 1px solid var(--yx-border-default); border-left: .35rem solid var(--yx-color-sage-strong); background: var(--yx-surface-default); }
.evidence-player__empty { display: grid; gap: .35rem; color: var(--yx-text-secondary); }
.evidence-player__controls { display: grid; grid-template-columns: auto minmax(8rem, 1fr) auto auto; gap: .75rem; align-items: center; }
button, select { min-height: 2.75rem; font: inherit; }
button { border: 1px solid currentColor; background: transparent; color: var(--yx-action-link); cursor: pointer; }
button:focus-visible, select:focus-visible, input:focus-visible { outline: 3px solid var(--yx-color-gold); outline-offset: 2px; }
input { width: 100%; accent-color: var(--yx-color-sage-strong); }
.evidence-player__state { margin: .5rem 0 0; color: var(--yx-text-muted); }
.evidence-player__anchors { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .75rem; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
@media (max-width: 48rem) { .evidence-player__controls { grid-template-columns: auto 1fr; } .evidence-player__controls label:first-of-type { grid-column: 1 / -1; grid-row: 1; } }
@media (prefers-reduced-motion: reduce) { .evidence-player * { scroll-behavior: auto !important; transition: none !important; } }
</style>
