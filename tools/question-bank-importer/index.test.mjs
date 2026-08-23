import test from "node:test";
import assert from "node:assert/strict";
import {
  bindAnswerGroups,
  bindAudio,
  matchImageOccurrence,
  parseAnswerDocument,
  parseQuestionDocument,
  scoringSummary,
  selectLevels,
  validateQuestions,
} from "./index.mjs";

function doc(...texts) {
  return {
    paragraphs: texts.map((entry, index) => (
      typeof entry === "string" ? { index, text: entry, rids: [] } : { index, text: entry.text, rids: entry.rids ?? [] }
    )),
    occurrences: [],
  };
}

function question(level, family, sourceOrder, maxScore = 1) {
  return {
    level,
    family,
    sourceOrder,
    maxScore,
    domain: "TEST",
    deliverySpec: { stimulus: { type: "TEXT", promptText: `source ${sourceOrder}` }, response: { type: "TEXT" } },
    scoringSpec: { strategy: "TEST", maxScore },
    mediaBindings: { images: [] },
  };
}

function answerFixture() {
  return doc(
    "答案",
    "【水平一级】",
    "一、听",
    "听音选图",
    "1.A 2.B 3.C",
    "听写句子",
    "1.听写一 2.听写二 3.听写三",
    "二、说",
    "朗读原文",
    "无",
    "看图说话",
    "参考示例：这是一个参考示例。",
    "三、读",
    "单词认读",
    "1.C 2.B 3.A",
    "句子理解",
    "1.A 2.B 3.C",
    "四、写",
    "看图写词",
    "1.词语一/词语二 2.词语三",
    "句子补全",
    "1.补全一 2.补全二",
    "评分细则",
    "听音选图",
    "选项正误",
    "选错图片扣1分",
    "听写句子",
    "错字扣1分",
    "句子补全",
    "句式偏差扣2分",
  );
}

test("numbered blocks retain authored text, ordinal, and paragraph source trace", () => {
  const parsed = parseQuestionDocument(doc(
    "【水平一级】",
    "听（24分）",
    "听音选图（9分）",
    "1.音频：第一词",
    { text: "配图选项", rids: ["rB", "rA", "rD", "rC"] },
    "2.音频：第二词",
    { text: "配图选项", rids: ["r1", "r2", "r3", "r4"] },
  ));
  const questions = parsed[0].questions;
  assert.equal(questions.length, 2);
  assert.deepEqual(questions[0].deliverySpec.response.options.map((option) => option.key), ["A", "B", "C", "D"]);
  assert.deepEqual(questions[0].mediaBindings.imageRids, ["rB", "rA", "rD", "rC"]);
  assert.equal(questions[0].deliverySpec.stimulus.promptText, "第一词");
  assert.deepEqual(questions[0].sourceTrace.questionDocx, { familyLabel: "听音选图", paragraphStart: 3, paragraphEnd: 4, });
  assert.equal(questions[1].sourceOrder, 2);
});

test("unnumbered blocks use paragraph boundaries and exclude instruction paragraphs", () => {
  const parsed = parseQuestionDocument(doc(
    "【水平三级】",
    "说（26分）",
    "朗读句子",
    "请朗读以下句子",
    "第一段 authored text",
    "第二段 authored text",
    "读（24分）",
    "单词认读",
    "无编号词语（ ）",
    "A.选项一",
    "B.选项二",
    "C.选项三",
    "D.选项四",
  ));
  const readAloud = parsed[0].questions.filter((question) => question.family === "READ_ALOUD");
  assert.equal(readAloud.length, 2);
  assert.deepEqual(readAloud.map((question) => question.deliverySpec.stimulus.promptText), ["第一段 authored text", "第二段 authored text"]);
  assert.equal(readAloud[0].sourceTrace.questionDocx.paragraphStart, 4);
  assert.equal(readAloud[1].sourceTrace.questionDocx.paragraphEnd, 5);
  const word = parsed[0].questions.find((question) => question.family === "WORD_RECOGNITION");
  assert.equal(word.deliverySpec.stimulus.promptText, "无编号词语（ ）");
});

test("generic completion grammar splits two unnumbered authored blocks without a level pivot", () => {
  const parsed = parseQuestionDocument(doc(
    "【水平五级】",
    "写（26分）",
    "句子补全",
    "通过析字趣解汉字，请完成第一题。",
    "示例：这是第一题的示例。",
    "第一题横线。",
    "请仿照画线句完成第二题。",
    "第二题横线。",
    "读（24分）",
  ));
  const questions = parsed[0].questions;
  assert.equal(questions.length, 2);
  assert.match(questions[0].deliverySpec.stimulus.promptText, /第一题的示例/);
  assert.match(questions[1].deliverySpec.stimulus.promptText, /第二题横线/);
  assert.equal(/level === 3|level === 5|monkey/i.test(JSON.stringify(questions)), false);
});

test("the same completion grammar handles both level-three and level-five source blocks", () => {
  const parsed = parseQuestionDocument(doc(
    "【水平三级】",
    "写（26分）",
    "句子补全",
    "第一道题的 authored prompt",
    "请仿照示例完成第二道题",
    "第二道题的 authored prompt",
    "【水平五级】",
    "写（26分）",
    "句子补全",
    "第一道题的 authored prompt",
    "请仿照示例完成第二道题",
    "第二道题的 authored prompt",
  ));
  assert.deepEqual(parsed.map((level) => level.questions.length), [2, 2]);
  assert.deepEqual(parsed.map((level) => level.questions.map((item) => item.sourceOrder)), [[1, 2], [1, 2]]);
});

test("answer groups bind by level, canonical family, and source ordinal", () => {
  const answerDocument = parseAnswerDocument(answerFixture());
  assert.equal(answerDocument.groups.length, 8);
  assert.deepEqual(answerDocument.groups.map((group) => group.family), [
    "LISTEN_IMAGE_CHOICE", "DICTATION", "READ_ALOUD", "PICTURE_SPEAKING",
    "WORD_RECOGNITION", "SENTENCE_COMPREHENSION", "PICTURE_WORD", "SENTENCE_COMPLETION",
  ]);
  assert.equal(answerDocument.groups.find((group) => group.family === "WORD_RECOGNITION").entries[0].value, "C");
  assert.equal(answerDocument.rubrics.length, 3);

  const familyCounts = {
    LISTEN_IMAGE_CHOICE: [3, 3], DICTATION: [3, 5], READ_ALOUD: [3, 4], PICTURE_SPEAKING: [1, 14],
    WORD_RECOGNITION: [3, 4], SENTENCE_COMPREHENSION: [3, 4], PICTURE_WORD: [2, 5], SENTENCE_COMPLETION: [2, 8],
  };
  const level = { level: 1, questions: Object.entries(familyCounts).flatMap(([family, [count, points]]) => (
    Array.from({ length: count }, (_, index) => question(1, family, index + 1, points))
  )) };
  const issues = [];
  bindAnswerGroups([level], answerDocument, issues);
  assert.deepEqual(issues, []);
  assert.deepEqual(scoringSummary([level]), { items: 20, points: 100, bound: 20, missing: 0, ambiguous: 0 });
  const completion = level.questions.find((item) => item.family === "SENTENCE_COMPLETION");
  assert.equal(completion.scoringSpec.referenceAnswer, "补全一");
  assert.ok(completion.scoringSpec.rubric.length);
  assert.ok(completion.scoringSpec.deductionRules.length);
  assert.ok(completion.scoringSpec.sourceTrace.answerDocx.answerGroup.paragraphStart >= 0);
  assert.equal(level.questions.find((item) => item.family === "READ_ALOUD").scoringSpec.targetText, "source 1");
  assert.equal(JSON.stringify(level).includes("referenceAnswer"), true);
  assert.equal(JSON.stringify(level.questions[0].deliverySpec).includes("referenceAnswer"), false);
});

test("answer binding fails closed for missing, ambiguous, and invalid answers", () => {
  const missingIssues = [];
  bindAnswerGroups([{ level: 1, questions: [question(1, "DICTATION", 1)] }], { groups: [], rubrics: [] }, missingIssues);
  assert.equal(missingIssues[0].code, "ANSWER_MISSING");

  const ambiguousIssues = [];
  const duplicate = parseAnswerDocument(answerFixture());
  duplicate.groups.push(duplicate.groups[0]);
  bindAnswerGroups([{ level: 1, questions: [question(1, "LISTEN_IMAGE_CHOICE", 1)] }], duplicate, ambiguousIssues);
  assert.equal(ambiguousIssues[0].code, "ANSWER_AMBIGUOUS");

  const invalidIssues = [];
  const invalid = parseAnswerDocument(doc("答案", "【水平一级】", "单词认读", "1.X"));
  bindAnswerGroups([{ level: 1, questions: [question(1, "WORD_RECOGNITION", 1)] }], invalid, invalidIssues);
  assert.equal(invalidIssues[0].code, "INVALID_ANSWER_OPTION");
});

test("image matching is exact, perceptual, ZIP-order independent, and fail-closed", () => {
  const source = { sha256: "source", fp: [0, 0, 0, 0], occurrence: 7 };
  const exact = matchImageOccurrence(source, [
    { zipPath: "z/second.png", sha256: "other", fp: [1, 1, 1, 1] },
    { zipPath: "z/first.png", sha256: "source", fp: [0, 0, 0, 1] },
  ]);
  assert.equal(exact.status, "MATCH");
  assert.equal(exact.match, "exact");
  assert.equal(exact.candidate.zipPath, "z/first.png");

  const perceptual = matchImageOccurrence(source, [
    { zipPath: "z/far.png", sha256: "far", fp: [1, 1, 1, 1] },
    { zipPath: "z/near.png", sha256: "near", fp: [0, 0, 0, 1] },
  ]);
  assert.equal(perceptual.status, "MATCH");
  assert.equal(perceptual.match, "perceptual");
  assert.equal(perceptual.candidate.zipPath, "z/near.png");
  assert.equal(matchImageOccurrence(source, [{ zipPath: "z/no.png", sha256: "no", fp: [1, 1, 1, 1] }], { threshold: 2 }).status, "UNMATCHED");
  assert.equal(matchImageOccurrence(source, [
    { zipPath: "z/a.png", sha256: "a", fp: [0, 0, 0, 1] },
    { zipPath: "z/b.png", sha256: "b", fp: [0, 0, 1, 0] },
  ]).status, "AMBIGUOUS");
  assert.equal(matchImageOccurrence(source, [
    { zipPath: "z/a.png", sha256: "same", fp: [0, 0, 0, 0] },
    { zipPath: "z/b.png", sha256: "same", fp: [0, 0, 0, 0] },
  ]).status, "AMBIGUOUS");
});

test("audio mapping is unique-only and does not silently choose a file", () => {
  const unique = question(1, "DICTATION", 2);
  const uniqueIssues = [];
  bindAudio(unique, [{ mediaType: "AUDIO", level: 1, filename: "2.答案.mp3", zipPath: "水平一级/听写句子/2.答案.mp3", sha256: "two" }], uniqueIssues);
  assert.deepEqual(uniqueIssues, []);
  assert.equal(unique.mediaBindings.audio.zipPath, "水平一级/听写句子/2.答案.mp3");

  const missingIssues = [];
  bindAudio(question(1, "DICTATION", 1), [], missingIssues);
  assert.equal(missingIssues[0].code, "MEDIA_MISSING");
  const ambiguousIssues = [];
  bindAudio(question(1, "DICTATION", 1), [
    { mediaType: "AUDIO", level: 1, filename: "1-a.mp3", zipPath: "水平一级/听写句子/1-a.mp3", sha256: "a" },
    { mediaType: "AUDIO", level: 1, filename: "1-b.mp3", zipPath: "水平一级/听写句子/1-b.mp3", sha256: "b" },
  ], ambiguousIssues);
  assert.equal(ambiguousIssues[0].code, "AUDIO_AMBIGUOUS");
});

test("structural validation catches counts, points, and delivery scoring leaks", () => {
  const issues = [];
  validateQuestions([{ level: 1, questions: [{ ...question(1, "DICTATION", 1, 5), deliverySpec: { correctAnswer: "A" } }] }], issues);
  assert.ok(issues.some((issue) => issue.code === "QUESTION_COUNT_MISMATCH"));
  assert.ok(issues.some((issue) => issue.code === "POINT_TOTAL_MISMATCH"));
  assert.ok(issues.some((issue) => issue.code === "DELIVERY_SCORING_LEAK"));
});

test("EXACT_CHOICE validation rejects an answer key absent from authored options", () => {
  const issues = [];
  validateQuestions([{
    level: 1,
    questions: [{
      ...question(1, "WORD_RECOGNITION", 3, 4),
      stableKey: "L1-READ-WORD_RECOGNITION-003",
      deliverySpec: {
        stimulus: { type: "TEXT", promptText: "source" },
        response: { type: "CHOICE", options: [{ key: "B" }, { key: "C" }, { key: "D" }] },
      },
      scoringSpec: { strategy: "EXACT_CHOICE", maxScore: 4, referenceAnswer: "A" },
    }],
  }], issues);
  assert.ok(issues.some((issue) => issue.code === "ANSWER_OPTION_INVALID"));
  assert.ok(issues.some((issue) => issue.code === "BLOCKED_CONTENT_MISMATCH"));
  assert.equal(issues.find((issue) => issue.code === "ANSWER_OPTION_INVALID")?.stableKey, "L1-READ-WORD_RECOGNITION-003");
});

test("level filtering isolates the selected manifest", () => {
  const all = [{ level: 1, questions: [] }, { level: 2, questions: [] }];
  assert.deepEqual(selectLevels(all, 1), [all[0]]);
  assert.deepEqual(selectLevels(all), all);
});
