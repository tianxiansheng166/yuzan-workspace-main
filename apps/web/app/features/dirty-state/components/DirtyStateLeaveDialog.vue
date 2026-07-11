<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";

import { YxButton, YxStatus } from "@yuzan/ui";

import { useDirtyStateRegistry } from "../composables/useDirtyStateRegistry";
import { createLeaveCoordinator } from "../leave-coordinator";
import type {
  DirtyStateEntry,
  DirtyStateEntrySaveResult,
} from "../types";

const { registry, leaveRequest } = useDirtyStateRegistry();
const router = useRouter();
const coordinator = createLeaveCoordinator({ router });

const dialogRef = ref<HTMLDialogElement | null>(null);
const saving = ref(false);
const saveResults = ref<Record<string, DirtyStateEntrySaveResult> | null>(null);
const open = computed(() => leaveRequest.value !== null);
const entries = computed(() => leaveRequest.value?.blockingEntries ?? []);

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    CLEAN: "已保存",
    DIRTY: "未保存",
    SAVING: "保存中",
    SAVED_LOCAL: "已保存到本地",
    WAITING_SYNC: "等待同步",
    SAVE_FAILED: "保存失败",
    CONFLICT: "服务端冲突",
    DISCARDING: "放弃中",
  };
  return map[status] ?? status;
}

function statusTone(
  status: string,
): "neutral" | "success" | "warning" | "danger" | "information" {
  switch (status) {
    case "CLEAN":
    case "SAVED_LOCAL":
      return "success";
    case "SAVING":
    case "WAITING_SYNC":
      return "information";
    case "SAVE_FAILED":
    case "CONFLICT":
      return "danger";
    case "DISCARDING":
      return "warning";
    case "DIRTY":
    default:
      return "warning";
  }
}

function isResolvedConflict(entry: DirtyStateEntry): boolean {
  return entry.status === "CONFLICT" || entry.status === "SAVE_FAILED";
}

async function saveAndContinue(): Promise<void> {
  if (!leaveRequest.value) return;
  saving.value = true;
  saveResults.value = null;

  try {
    const results = await coordinator.saveEntries(entries.value);
    saveResults.value = results;

    const allSuccess = Object.values(results).every(
      (result) => result.status === "success",
    );

    if (allSuccess) {
      await coordinator.executeDecision("save-and-leave", leaveRequest.value.reason);
    }
  } finally {
    saving.value = false;
  }
}

async function discardAndContinue(): Promise<void> {
  if (!leaveRequest.value) return;
  saving.value = true;
  try {
    await coordinator.discardEntries(entries.value);
    await coordinator.executeDecision(
      "discard-and-leave",
      leaveRequest.value.reason,
    );
  } finally {
    saving.value = false;
  }
}

function stayEditing(): void {
  registry.cancelLeave();
  saveResults.value = null;
}

function onDialogClick(event: MouseEvent): void {
  const rect = dialogRef.value?.getBoundingClientRect();
  if (!rect) return;
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  ) {
    stayEditing();
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    stayEditing();
  }
}

watch(
  () => leaveRequest.value,
  async (request) => {
    if (request) {
      saveResults.value = null;
      await nextTick();
      dialogRef.value?.showModal();
      dialogRef.value?.focus();
    } else {
      dialogRef.value?.close();
    }
  },
  { flush: "post" },
);

watch(
  () => open.value,
  (isOpen) => {
    if (!isOpen) {
      saving.value = false;
      saveResults.value = null;
    }
  },
);
</script>

<template>
  <dialog
    v-if="open"
    ref="dialogRef"
    class="dirty-leave-dialog"
    aria-modal="true"
    aria-labelledby="dirty-leave-title"
    aria-describedby="dirty-leave-description"
    @click="onDialogClick"
    @keydown="onKeydown"
  >
    <div class="dirty-leave-dialog__content">
      <header class="dirty-leave-dialog__header">
        <p class="yx-kicker">未保存修改</p>
        <h2 id="dirty-leave-title">离开前请确认未保存内容</h2>
        <p id="dirty-leave-description">
          当前有 {{ entries.length }} 项未保存修改。你可以选择保存、放弃或返回继续编辑。
        </p>
      </header>

      <div
        v-if="saveResults"
        class="dirty-leave-dialog__results"
        role="status"
        aria-live="polite"
      >
        <p
          v-if="Object.values(saveResults).every((r) => r.status === 'success')"
        >
          全部保存成功，正在继续离开……
        </p>
        <template v-else>
          <p>部分保存失败，请返回处理以下条目：</p>
          <ul>
            <li
              v-for="[id, result] in Object.entries(saveResults)"
              :key="id"
              v-show="result.status !== 'success'"
            >
              <YxStatus tone="danger">{{ result.message ?? "保存失败" }}</YxStatus>
              <span>{{ registry.get(id)?.title ?? id }}</span>
            </li>
          </ul>
        </template>
      </div>

      <ul
        class="dirty-leave-dialog__list"
        role="list"
        aria-label="未保存条目"
      >
        <li
          v-for="entry in entries"
          :key="entry.id"
          class="dirty-leave-dialog__item"
          :data-status="entry.status"
        >
          <div class="dirty-leave-dialog__item-header">
            <div>
              <strong>{{ entry.title }}</strong>
              <span
                v-if="entry.description"
                class="dirty-leave-dialog__description"
                >{{ entry.description }}</span
              >
            </div>
            <YxStatus :tone="statusTone(entry.status)">
              {{ statusLabel(entry.status) }}
            </YxStatus>
          </div>
          <div class="dirty-leave-dialog__meta">
            <span>来源：{{ entry.owner }}</span>
            <span>最后修改：{{ formatTime(entry.updatedAt) }}</span>
            <span v-if="entry.scope === 'SCHOOL'">范围：学校</span>
            <span v-else-if="entry.scope === 'ROUTE'">范围：当前页面</span>
            <span v-else-if="entry.scope === 'RESOURCE'">范围：资源</span>
            <span v-else>范围：全局</span>
          </div>

          <div
            v-if="entry.status === 'CONFLICT' || isResolvedConflict(entry)"
            class="dirty-leave-dialog__conflict"
            role="alert"
          >
            <p>服务端数据已变化。你可以选择返回编辑、重新加载或保留本地副本。</p>
            <div class="dirty-leave-dialog__conflict-actions">
              <YxButton
                kind="secondary"
                :disabled="saving"
                @click="stayEditing"
                >返回编辑</YxButton
              >
              <YxButton kind="quiet" :disabled="saving" @click="stayEditing"
                >保留本地副本</YxButton
              >
            </div>
          </div>
        </li>
      </ul>

      <footer class="dirty-leave-dialog__actions">
        <YxButton
          :loading="saving"
          :disabled="entries.some((e) => e.status === 'CONFLICT')"
          @click="saveAndContinue"
        >
          保存并继续
        </YxButton>
        <YxButton
          kind="secondary"
          :disabled="saving"
          @click="discardAndContinue"
        >
          放弃修改并继续
        </YxButton>
        <YxButton kind="quiet" :disabled="saving" @click="stayEditing">
          返回继续编辑
        </YxButton>
      </footer>
    </div>
  </dialog>
</template>

<style scoped>
.dirty-leave-dialog {
  max-width: min(42rem, calc(100vw - 2rem));
  max-height: calc(100svh - 2rem);
  margin: auto;
  padding: 0;
  border: 1px solid var(--yx-border-strong);
  border-radius: var(--yx-radius-lg);
  background: var(--yx-surface-raised);
  color: var(--yx-text-primary);
  box-shadow: var(--yx-shadow-300);
  overflow: hidden;
}

.dirty-leave-dialog::backdrop {
  background: rgba(62, 49, 36, 0.45);
  backdrop-filter: blur(2px);
}

.dirty-leave-dialog__content {
  display: grid;
  max-height: calc(100svh - 2rem);
}

.dirty-leave-dialog__header {
  padding: clamp(1.25rem, 3vw, 2rem);
  border-bottom: 1px solid var(--yx-border-default);
  background: linear-gradient(
    180deg,
    var(--yx-surface-raised),
    var(--yx-bg-canvas)
  );
}

.dirty-leave-dialog__header h2 {
  margin: 0.35rem 0 0.5rem;
  font-family: var(--yx-font-display);
}

.dirty-leave-dialog__header p {
  margin: 0;
  color: var(--yx-text-secondary);
  line-height: 1.65;
}

.dirty-leave-dialog__results {
  padding: 1rem clamp(1.25rem, 3vw, 2rem);
  border-bottom: 1px solid var(--yx-border-default);
  background: var(--yx-warning-bg);
  color: var(--yx-warning-fg);
}

.dirty-leave-dialog__results ul {
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.5rem;
}

.dirty-leave-dialog__results li {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.dirty-leave-dialog__list {
  margin: 0;
  padding: clamp(1rem, 2.5vw, 1.5rem) clamp(1.25rem, 3vw, 2rem);
  list-style: none;
  display: grid;
  gap: 1rem;
  overflow-y: auto;
}

.dirty-leave-dialog__item {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--yx-border-default);
  border-radius: var(--yx-radius-md);
  background: var(--yx-surface-default);
}

.dirty-leave-dialog__item[data-status="CONFLICT"],
.dirty-leave-dialog__item[data-status="SAVE_FAILED"] {
  border-color: var(--yx-danger-border);
}

.dirty-leave-dialog__item-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: start;
}

.dirty-leave-dialog__item-header > div {
  display: grid;
  gap: 0.25rem;
}

.dirty-leave-dialog__description {
  color: var(--yx-text-secondary);
  font-size: var(--yx-text-sm);
}

.dirty-leave-dialog__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  font-size: var(--yx-text-sm);
  color: var(--yx-text-muted);
}

.dirty-leave-dialog__conflict {
  display: grid;
  gap: 0.75rem;
  padding: 0.875rem;
  border-left: 0.3rem solid var(--yx-danger-border);
  background: var(--yx-danger-bg);
  color: var(--yx-danger-fg);
  border-radius: 0 var(--yx-radius-sm) var(--yx-radius-sm) 0;
}

.dirty-leave-dialog__conflict p {
  margin: 0;
}

.dirty-leave-dialog__conflict-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.dirty-leave-dialog__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: flex-end;
  padding: clamp(1rem, 2.5vw, 1.5rem) clamp(1.25rem, 3vw, 2rem);
  border-top: 1px solid var(--yx-border-default);
  background: var(--yx-bg-canvas);
}

@media (max-width: 40rem) {
  .dirty-leave-dialog__actions {
    flex-direction: column;
  }

  .dirty-leave-dialog__actions :deep(button) {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dirty-leave-dialog,
  .dirty-leave-dialog::backdrop {
    transition: none;
    animation: none;
  }
}
</style>
