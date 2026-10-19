import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("./bilingual-content.js", import.meta.url), "utf8");

function load() {
  const window = {};
  vm.runInNewContext(source, { window });
  return window.CourseBilingualContent;
}

test("normal strings and structured text retain the Mandarin original safely", () => {
  const bilingual = load();
  assert.equal(bilingual.normalize("普通话原文").originalText, "普通话原文");
  assert.equal(bilingual.normalize({ originalText: "普通话原文", translation: {} }).originalText, "普通话原文");
  assert.equal(bilingual.normalize({ originalText: {}, translation: "unsafe" }).originalText, "");
  assert.equal(bilingual.normalize({ originalText: "普通话原文" }).translation, "");
});

test("only nonempty expert-confirmed Tibetan-target content can expose the helper", () => {
  const bilingual = load();
  const approvedTestFixture = {
    originalText: "TEST_FIXTURE_ONLY 普通话原文",
    translation: "TEST_FIXTURE_ONLY 辅助文本",
    locale: "zh-CN",
    translationLocale: "bo-CN",
    translationSource: "EXPERT",
    reviewStatus: "EXPERT_CONFIRMED",
  };
  assert.equal(bilingual.hasReviewedTibetanTranslation(approvedTestFixture), true);

  const negatives = [
    { ...approvedTestFixture, translation: "  " },
    { ...approvedTestFixture, translationLocale: "" },
    { ...approvedTestFixture, translationLocale: "en" },
    { ...approvedTestFixture, reviewStatus: "PENDING" },
    { ...approvedTestFixture, reviewStatus: "REVIEWED" },
    { ...approvedTestFixture, translationSource: "AUTO" },
    { ...approvedTestFixture, translationSource: "NONE" },
    { ...approvedTestFixture, locale: "bo-CN" },
    { ...approvedTestFixture, translation: { text: "not a string" } },
  ];
  for (const value of negatives) {
    assert.equal(bilingual.hasReviewedTibetanTranslation(value), false);
  }
});
