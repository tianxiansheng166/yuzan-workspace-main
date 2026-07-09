import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readPage = (relativePath: string) =>
  readFileSync(
    resolve(import.meta.dirname, "../../app", relativePath),
    "utf-8",
  );

describe("tibetan translation page", () => {
  it("imports TibetanTranslator explicitly so the page does not render blank", () => {
    const page = readPage("pages/tools/tibetan-translation.vue");

    expect(page).toContain("import TibetanTranslator");
    expect(page).toContain("<TibetanTranslator />");
  });

  it("keeps local phrase and pending voice labels", () => {
    const phrases = readPage("features/tibetan-translation/Phrases.ts");
    const component = readPage(
      "features/tibetan-translation/components/TibetanTranslator.vue",
    );

    expect(phrases).toContain("本地教学短语，不是实时翻译");
    expect(component).toContain("LOCAL_PHRASE_LABEL");
    expect(component).toContain("语音输入待接入");
    expect(component).toContain("朗读待接入");
  });
});
