import { describe, expect, it } from "vitest";
import { nextTick } from "vue";
import {
  COMMON_TEACHING_PHRASES,
  findLocalPhrase,
  phraseToResult,
} from "../../app/features/tibetan-translation/Phrases";
import { useTranslation } from "../../app/features/tibetan-translation/useTranslation";

describe("useTranslation", () => {
  it("starts with empty state and zh-to-bo direction", () => {
    const t = useTranslation({ apiBaseUrl: "http://localhost:4000/api/v1" });

    expect(t.sourceText.value).toBe("");
    expect(t.direction.value).toBe("zh-to-bo");
    expect(t.result.value).toBeNull();
    expect(t.isLoading.value).toBe(false);
  });

  it("returns local phrase without calling API", async () => {
    const t = useTranslation({ apiBaseUrl: "http://localhost:4000/api/v1" });
    t.sourceText.value = "你好";

    await t.translate();
    await nextTick();

    expect(t.result.value).not.toBeNull();
    expect(t.result.value?.isLocalPhrase).toBe(true);
    expect(t.result.value?.target).toBe("khyed rang bde mo");
    expect(t.error.value).toBeNull();
  });

  it("reports error for non-phrase input when API is unavailable", async () => {
    const t = useTranslation({ apiBaseUrl: "http://localhost:4000/api/v1" });
    t.sourceText.value = "任意未收录文本";

    await t.translate();

    expect(t.result.value).toBeNull();
    expect(t.error.value).toContain("未接入");
  });

  it("clears state when clear is called", async () => {
    const t = useTranslation({ apiBaseUrl: "http://localhost:4000/api/v1" });
    t.sourceText.value = "你好";
    await t.translate();

    t.clear();

    expect(t.sourceText.value).toBe("");
    expect(t.result.value).toBeNull();
    expect(t.error.value).toBeNull();
  });

  it("swaps direction and clears result", async () => {
    const t = useTranslation({ apiBaseUrl: "http://localhost:4000/api/v1" });
    t.sourceText.value = "你好";
    await t.translate();

    t.swapDirection();

    expect(t.direction.value).toBe("bo-to-zh");
    expect(t.result.value).toBeNull();
  });

  it("exposes common teaching phrases", () => {
    const t = useTranslation({ apiBaseUrl: "http://localhost:4000/api/v1" });

    expect(t.commonPhrases.length).toBeGreaterThan(0);
    expect(t.commonPhrases).toBe(COMMON_TEACHING_PHRASES);
  });
});

describe("Phrases helpers", () => {
  it("finds exact local phrase for zh-to-bo", () => {
    const phrase = findLocalPhrase("谢谢", "zh-to-bo");

    expect(phrase).toBeDefined();
    expect(phrase?.bo).toBe("thug rje che");
  });

  it("returns undefined for unknown text", () => {
    const phrase = findLocalPhrase("不存在", "zh-to-bo");

    expect(phrase).toBeUndefined();
  });

  it("converts phrase to result in both directions", () => {
    const phrase = COMMON_TEACHING_PHRASES[0];

    const zhToBo = phraseToResult(phrase, "zh-to-bo");
    expect(zhToBo.source).toBe(phrase.zh);
    expect(zhToBo.target).toBe(phrase.bo);

    const boToZh = phraseToResult(phrase, "bo-to-zh");
    expect(boToZh.source).toBe(phrase.bo);
    expect(boToZh.target).toBe(phrase.zh);
  });
});
