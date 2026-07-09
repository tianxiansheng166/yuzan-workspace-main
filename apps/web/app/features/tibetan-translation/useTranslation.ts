import { computed, ref } from "vue";
import {
  COMMON_TEACHING_PHRASES,
  findLocalPhrase,
  phraseToResult,
} from "./Phrases";
import { TranslationError, TranslationGateway } from "./TranslationGateway";
import type { TranslationDirection, TranslationResult } from "./types";

export interface UseTranslationOptions {
  apiBaseUrl: string;
}

export function useTranslation(options: UseTranslationOptions) {
  const gateway = new TranslationGateway({ baseUrl: options.apiBaseUrl });

  const sourceText = ref("");
  const direction = ref<TranslationDirection>("zh-to-bo");
  const result = ref<TranslationResult | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const copied = ref(false);

  const sourcePlaceholder = computed(() =>
    direction.value === "zh-to-bo" ? "输入中文" : "输入藏语（Wylie 转写）",
  );

  const targetPlaceholder = computed(() =>
    direction.value === "zh-to-bo" ? "藏语结果" : "中文结果",
  );

  async function translate() {
    const text = sourceText.value.trim();
    if (!text) {
      error.value = "请输入需要翻译的内容";
      return;
    }

    error.value = null;
    result.value = null;
    isLoading.value = true;

    const currentDirection = direction.value;

    const localPhrase = findLocalPhrase(text, currentDirection);
    if (localPhrase) {
      const { source, target } = phraseToResult(localPhrase, currentDirection);
      result.value = {
        source,
        target,
        direction: currentDirection,
        isLocalPhrase: true,
      };
      isLoading.value = false;
      return;
    }

    try {
      result.value = await gateway.translate({
        text,
        direction: currentDirection,
      });
    } catch (err) {
      if (err instanceof TranslationError) {
        error.value = err.message;
      } else {
        error.value = "翻译失败，请检查网络后重试";
      }
    } finally {
      isLoading.value = false;
    }
  }

  function clear() {
    sourceText.value = "";
    result.value = null;
    error.value = null;
    copied.value = false;
  }

  async function copyResult() {
    if (!result.value) return;
    try {
      await navigator.clipboard.writeText(result.value.target);
      copied.value = true;
      window.setTimeout(() => {
        copied.value = false;
      }, 1500);
    } catch {
      error.value = "复制失败，请手动选择文本复制";
    }
  }

  function swapDirection() {
    direction.value = direction.value === "zh-to-bo" ? "bo-to-zh" : "zh-to-bo";
    result.value = null;
    error.value = null;
    copied.value = false;
  }

  function usePhrase(phraseText: string) {
    sourceText.value = phraseText;
    void translate();
  }

  return {
    sourceText,
    direction,
    result,
    isLoading,
    error,
    copied,
    sourcePlaceholder,
    targetPlaceholder,
    commonPhrases: COMMON_TEACHING_PHRASES,
    translate,
    clear,
    copyResult,
    swapDirection,
    usePhrase,
  };
}
