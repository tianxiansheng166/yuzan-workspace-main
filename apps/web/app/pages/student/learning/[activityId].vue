<script setup lang="ts">
import PlayerStepper from "~/features/learning-player/components/PlayerStepper.vue";
import { useLearningPlayer } from "~/features/learning-player/composables/useLearningPlayer";

const route = useRoute();
const activityId = String(route.params.activityId ?? "");
const player = useLearningPlayer(activityId);
await player.load();

function requestExit() {
  if (
    player.needsExitConfirmation.value &&
    import.meta.client &&
    !window.confirm("还有未同步的学习内容。确定返回今日页吗？")
  )
    return;
  navigateTo("/student/today");
}
</script>

<template>
  <main class="player yx-shell">
    <header class="player__header">
      <button type="button" class="back" @click="requestExit">
        返回今日页
      </button>
      <p class="yx-kicker">学习播放器 · DEMO</p>
    </header>

    <section
      v-if="player.viewState.value === 'loading'"
      class="state"
      aria-live="polite"
    >
      <h1>正在打开学习活动……</h1>
    </section>
    <section
      v-else-if="player.viewState.value === 'unknown'"
      class="state"
      role="alert"
    >
      <h1>没有找到这个学习活动。</h1>
      <p>返回今日页选择一个现有任务，不会产生任何提交记录。</p>
      <NuxtLink to="/student/today">返回今日页</NuxtLink>
    </section>
    <section v-else-if="player.viewState.value === 'unavailable'" class="state">
      <h1>这个活动暂不可用。</h1>
      <p>请稍后再试，或先完成其他任务。</p>
    </section>

    <template v-else-if="player.activity.value">
      <div class="player__title">
        <div>
          <p class="yx-kicker">{{ player.activity.value.type }}</p>
          <h1>{{ player.activity.value.title }}</h1>
        </div>
        <span class="status">{{ player.snapshot.value.status }}</span>
      </div>
      <PlayerStepper :step-index="player.snapshot.value.stepIndex" />

      <article
        class="stage"
        :aria-labelledby="`step-${player.currentStep.value}`"
      >
        <section v-if="player.currentStep.value === 'goal'">
          <p class="yx-kicker">任务目标</p>
          <h2 :id="`step-${player.currentStep.value}`">
            {{ player.activity.value.goal }}
          </h2>
          <p>完成标准：{{ player.activity.value.completion }}</p>
        </section>
        <section v-else-if="player.currentStep.value === 'material'">
          <p class="yx-kicker">学习材料</p>
          <h2 :id="`step-${player.currentStep.value}`">先读懂，再开始操作。</h2>
          <p
            v-for="paragraph in player.activity.value.material"
            :key="paragraph"
            class="reading-text"
          >
            {{ paragraph }}
          </p>
        </section>
        <section v-else-if="player.currentStep.value === 'tip'">
          <p class="yx-kicker">示例与提示</p>
          <h2 :id="`step-${player.currentStep.value}`">
            {{ player.activity.value.tip }}
          </h2>
        </section>
        <section v-else-if="player.currentStep.value === 'practice'">
          <p class="yx-kicker">轮到你</p>
          <h2 :id="`step-${player.currentStep.value}`">
            {{ player.activity.value.prompt }}
          </h2>
          <div
            v-if="
              ['speaking', 'retest', 'initial-assessment'].includes(
                player.activity.value.type,
              )
            "
            class="unavailable"
            role="status"
          >
            <strong>朗读录音 unavailable</strong>
            <p>SPH-001 尚未接入。这里不会伪造录音、上传状态或发音分数。</p>
          </div>
          <label v-else class="response"
            ><span>你的回答</span
            ><textarea
              v-model="player.response.value"
              :readonly="player.readOnly.value"
              rows="6"
              aria-describedby="response-help"
            /><small id="response-help"
              >内容可先保存到本机；保存不等于已同步。</small
            ></label
          >
        </section>
        <section v-else-if="player.currentStep.value === 'check'">
          <p class="yx-kicker">检查</p>
          <h2 :id="`step-${player.currentStep.value}`">
            读一遍你的答案，确认意思完整。
          </h2>
          <p>
            AI 结果：{{
              player.activity.value.aiResult
            }}。当前不提供分数或自动诊断。
          </p>
        </section>
        <section v-else-if="player.currentStep.value === 'save'">
          <p class="yx-kicker">保存或提交</p>
          <h2 :id="`step-${player.currentStep.value}`">
            先安全保存，再决定下一步。
          </h2>
          <p>本机保存会标记为 local-only；服务不可用时不会显示 synced。</p>
          <div class="actions">
            <button
              type="button"
              :disabled="player.snapshot.value.busy || player.readOnly.value"
              @click="player.saveLocal"
            >
              保存到本机</button
            ><button
              type="button"
              :disabled="player.snapshot.value.busy || player.readOnly.value"
              @click="player.submit"
            >
              尝试提交
            </button>
          </div>
        </section>
        <section v-else>
          <p class="yx-kicker">下一步</p>
          <h2 :id="`step-${player.currentStep.value}`">
            回到今日页，继续沿着学习路径前进。
          </h2>
          <NuxtLink to="/student/today">查看今天的下一步</NuxtLink>
        </section>
      </article>

      <p
        v-if="player.message.value"
        class="message"
        role="status"
        aria-live="polite"
      >
        {{ player.message.value }}
      </p>
      <nav class="controls" aria-label="播放器步骤">
        <button
          type="button"
          :disabled="player.snapshot.value.stepIndex === 0"
          @click="player.send('BACK')"
        >
          上一步</button
        ><button
          type="button"
          :disabled="
            player.readOnly.value || player.snapshot.value.status === 'paused'
          "
          @click="player.send('NEXT')"
        >
          下一步</button
        ><button
          v-if="player.snapshot.value.status !== 'paused'"
          type="button"
          :disabled="player.readOnly.value"
          @click="player.send('PAUSE')"
        >
          暂停</button
        ><button v-else type="button" @click="player.send('RESUME')">
          继续
        </button>
      </nav>
    </template>
  </main>
</template>

<style scoped>
.player {
  padding-block: clamp(1.5rem, 5vw, 4rem);
}
.player__header,
.player__title,
.controls,
.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}
.back,
button {
  min-height: 2.75rem;
  padding: 0.55rem 0.9rem;
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-md);
  background: var(--yx-color-surface);
  color: var(--yx-color-ink);
  font: inherit;
  cursor: pointer;
}
button:focus-visible,
a:focus-visible,
textarea:focus-visible {
  outline: 3px solid var(--yx-color-gold);
  outline-offset: 3px;
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
h1,
h2 {
  font-family: var(--yx-font-display);
}
h1 {
  margin: 0.5rem 0;
  font-size: clamp(2rem, 6vw, 4.7rem);
  line-height: 1;
}
h2 {
  font-size: clamp(1.5rem, 3vw, 2.4rem);
}
.status {
  padding: 0.45rem 0.7rem;
  border: 1px solid currentColor;
  border-radius: var(--yx-radius-pill);
}
.stage {
  min-height: 25rem;
  display: grid;
  align-content: center;
  max-width: 58rem;
  padding: clamp(1.5rem, 5vw, 4rem) 0;
}
.stage p,
.reading-text {
  color: var(--yx-color-ink-soft);
  line-height: 1.85;
}
.reading-text {
  max-width: 38em;
  font-size: clamp(1.05rem, 2vw, 1.25rem);
}
.response {
  display: grid;
  gap: 0.5rem;
}
textarea {
  width: 100%;
  border: 1px solid var(--yx-color-line);
  border-radius: var(--yx-radius-md);
  padding: 1rem;
  font: inherit;
  line-height: 1.7;
}
.unavailable,
.message {
  padding: 1rem;
  border-left: 3px solid var(--yx-color-gold);
  background: var(--yx-color-paper);
}
.controls {
  padding-top: 1rem;
  border-top: 1px solid var(--yx-color-line);
}
.state {
  min-height: 60vh;
  display: grid;
  align-content: center;
  max-width: 44rem;
}
@media (max-width: 30rem) {
  .controls button {
    flex: 1 1 40%;
  }
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
</style>
