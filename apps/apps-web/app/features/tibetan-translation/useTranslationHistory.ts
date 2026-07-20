import { ref, watch } from "vue";
import type { TranslationHistoryItem, TranslationResult } from "./types";

const STORAGE_KEY = "yuzan:translation-history";
const MAX_HISTORY = 50;

export function useTranslationHistory() {
  const history = ref<TranslationHistoryItem[]>([]);

  function load() {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        history.value = JSON.parse(raw) as TranslationHistoryItem[];
      }
    } catch {
      history.value = [];
    }
  }

  function persist() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history.value));
    } catch {
      // localStorage 不可用时静默失败，不影响主流程。
    }
  }

  function add(result: TranslationResult) {
    const item: TranslationHistoryItem = {
      ...result,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now(),
    };
    history.value = [item, ...history.value].slice(0, MAX_HISTORY);
  }

  function clear() {
    history.value = [];
  }

  function remove(id: string) {
    history.value = history.value.filter((item) => item.id !== id);
  }

  watch(history, persist, { deep: true });

  return {
    history,
    load,
    add,
    clear,
    remove,
  };
}
