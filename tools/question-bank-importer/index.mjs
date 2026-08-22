#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

const exec = promisify(execFile);
const root = path.resolve(import.meta.dirname, "../..");
const defaults = {
  questions: path.join(root, "local_sources/question-bank/题库【三改】.docx"),
  answers: path.join(root, "local_sources/question-bank/答案及评分细则.docx"),
  media: path.join(root, "local_sources/question-bank/题库音频及图片.zip"),
  output: path.join(root, "local_sources/question-bank/.generated"),
};

const chineseLevels = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
const familyDefinitions = [
  { label: "听音选图", aliases: ["听音选图"], family: "LISTEN_IMAGE_CHOICE", domain: "LISTEN" },
  { label: "听写句子", aliases: ["听写句子"], family: "DICTATION", domain: "LISTEN" },
  { label: "朗读句子", aliases: ["朗读句子", "朗读原文"], family: "READ_ALOUD", domain: "SPEAK" },
  { label: "看图说话", aliases: ["看图说话"], family: "PICTURE_SPEAKING", domain: "SPEAK" },
  { label: "单词认读", aliases: ["单词认读"], family: "WORD_RECOGNITION", domain: "READ" },
  { label: "句子理解", aliases: ["句子理解"], family: "SENTENCE_COMPREHENSION", domain: "READ" },
  { label: "看图写词", aliases: ["看图写词"], family: "PICTURE_WORD", domain: "WRITE" },
  { label: "句子补全", aliases: ["句子补全", "句式改写"], family: "SENTENCE_COMPLETION", domain: "WRITE" },
];
const expected = {
  LISTEN_IMAGE_CHOICE: [3, 3],
  DICTATION: [3, 5],
  READ_ALOUD: [3, 4],
  PICTURE_SPEAKING: [1, 14],
  WORD_RECOGNITION: [3, 4],
  SENTENCE_COMPREHENSION: [3, 4],
  PICTURE_WORD: [2, 5],
  SENTENCE_COMPLETION: [2, 8],
};
const choiceFamilies = new Set(["LISTEN_IMAGE_CHOICE", "WORD_RECOGNITION", "SENTENCE_COMPREHENSION"]);
const speechFamilies = new Set(["READ_ALOUD", "PICTURE_SPEAKING"]);
const visualFamilies = new Set(["PICTURE_SPEAKING", "PICTURE_WORD"]);

const hash = (buffer) => createHash("sha256").update(buffer).digest("hex");
const addIssue = (issues, severity, code, detail = {}) => issues.push({ severity, code, ...detail });

function decodeXml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function plain(xml) {
  return decodeXml(xml
    .replace(/<w:tab\s*\/>/g, " ")
    .replace(/<w:br\s*\/>/g, " ")
    .replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, "$1")
    .replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

async function zipNames(file) {
  const { stdout } = await exec("unzip", ["-Z1", file], { maxBuffer: 32e6 });
  return stdout.split(/\r?\n/).filter(Boolean);
}

async function zipRead(file, name) {
  const { stdout } = await exec("unzip", ["-p", file, name], { encoding: "buffer", maxBuffer: 128e6 });
  return stdout;
}

export async function readDocx(file) {
  const [xml, relationships] = await Promise.all([
    zipRead(file, "word/document.xml"),
    zipRead(file, "word/_rels/document.xml.rels"),
  ]);
  const relationshipMap = Object.fromEntries(
    [...relationships.toString().matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)]
      .map(([, id, target]) => [id, path.posix.normalize(path.posix.join("word", target))]),
  );
  const paragraphs = [...xml.toString().matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((match, index) => ({
    index,
    text: plain(match[0]),
    rids: [...match[0].matchAll(/r:embed="([^"]+)"/g)].map((item) => item[1]),
  }));
  const occurrences = [];
  for (const paragraph of paragraphs) {
    for (const rid of paragraph.rids) {
      occurrences.push({
        occurrence: occurrences.length + 1,
        paragraph: paragraph.index,
        rid,
        entry: relationshipMap[rid],
      });
    }
  }
  return { paragraphs, occurrences };
}

export function levels(paragraphs) {
  return paragraphs
    .map((paragraph, index) => ({
      i: paragraph.index ?? index,
      level: chineseLevels[(paragraph.text.match(/水平([一二三四五六])级/) || [])[1]],
    }))
    .filter((entry) => entry.level);
}

function levelRanges(paragraphs) {
  const starts = levels(paragraphs);
  const documentEnd = paragraphs.find((paragraph) => paragraph.text.trim() === "评分细则")?.index ?? paragraphs.length;
  return starts.map((start, index) => ({
    ...start,
    end: Math.min(starts[index + 1]?.i ?? paragraphs.length, documentEnd),
  }));
}

function familyFromText(text) {
  const withoutSectionPrefix = text
    .replace(/^\s*[（(]?[一二三四五六\d]+[）)、.．、]\s*/, "")
    .trim();
  for (const definition of familyDefinitions) {
    if (definition.aliases.some((alias) => (
      withoutSectionPrefix === alias
      || new RegExp(`^${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[（(：:，, ])`).test(withoutSectionPrefix)
    ))) return definition;
  }
  return null;
}

function familyBlocks(paragraphs, range) {
  const starts = [];
  for (let i = range.i + 1; i < range.end; i += 1) {
    const family = familyFromText(paragraphs[i].text);
    if (family || isSectionHeading(paragraphs[i].text)) starts.push({ start: i, family });
  }
  return starts.filter((entry) => entry.family).map((entry) => ({
    ...entry,
    end: starts.find((next) => next.start > entry.start && (next.family || isSectionHeading(paragraphs[next.start].text)))?.start ?? range.end,
  }));
}

function isSectionHeading(text) {
  const section = text.replace(/^\s*[（(]?[一二三四五六\d]+[）)、.．、]\s*/, "").trim();
  return /^(?:听|说|读|写)(?:$|[（(：:])/.test(section);
}

function trace(start, end) {
  return { paragraphStart: start, paragraphEnd: Math.max(start, end) };
}

function strategy(family) {
  return {
    LISTEN_IMAGE_CHOICE: "EXACT_CHOICE",
    DICTATION: "DICTATION_ALIGNMENT",
    READ_ALOUD: "SPEECH_READING",
    PICTURE_SPEAKING: "SPEECH_OPEN_RESPONSE",
    WORD_RECOGNITION: "EXACT_CHOICE",
    SENTENCE_COMPREHENSION: "EXACT_CHOICE",
    PICTURE_WORD: "ACCEPTED_TEXT",
    SENTENCE_COMPLETION: "RUBRIC_TEXT",
  }[family];
}

function stripOrdinal(text) {
  return text.replace(/^\s*\d+\s*[.．、)]\s*/, "").trim();
}

function isInstructionText(text) {
  return /^(?:配图选项|音频[：:]|请(?:朗读|听写).*|朗读(?:以下|下列)?(?:句子|原文)?[：:]?|听写(?:以下|下列)?(?:句子)?[：:]?|每道\d*分|说明[：:]|无)$/.test(text.trim());
}

function numberedStart(text) {
  const match = text.match(/^\s*(\d+)\s*[.．、)]\s*(.*)$/);
  return match ? { ordinal: Number(match[1]), text: match[2].trim() } : null;
}

function optionParts(text) {
  const markers = [...text.matchAll(/(?:^|\s)([A-D])\s*[.．、:：]\s*/g)];
  if (!markers.length) return null;
  const prompt = text.slice(0, markers[0].index).trim();
  const options = markers.map((marker, index) => ({
    key: marker[1],
    text: text.slice(marker.index + marker[0].length, markers[index + 1]?.index ?? text.length).trim(),
  }));
  return { prompt, options };
}

function parseChoiceItems(paragraphs, block) {
  const items = [];
  let current = null;
  const flush = () => {
    if (!current) return;
    if (current.prompt || current.options.length) {
      items.push({
        ordinal: current.ordinal ?? items.length + 1,
        prompt: current.prompt.trim(),
        options: current.options,
        source: trace(current.start, current.end),
      });
    }
    current = null;
  };

  for (const paragraph of paragraphs.slice(block.start + 1, block.end)) {
    const text = paragraph.text.trim();
    if (!text || isInstructionText(text)) continue;
    const numbered = numberedStart(text);
    if (numbered) {
      flush();
      current = { ordinal: numbered.ordinal, prompt: "", options: [], start: paragraph.index, end: paragraph.index };
      const parts = optionParts(numbered.text);
      if (parts) {
        current.prompt = parts.prompt;
        current.options.push(...parts.options);
      } else {
        current.prompt = numbered.text;
      }
      continue;
    }
    const parts = optionParts(text);
    if (parts) {
      if (!current) current = { ordinal: items.length + 1, prompt: "", options: [], start: paragraph.index, end: paragraph.index };
      if (parts.prompt) current.prompt = `${current.prompt} ${parts.prompt}`.trim();
      current.options.push(...parts.options);
      current.end = paragraph.index;
      continue;
    }
    if (current?.options.length) flush();
    if (!current) current = { ordinal: items.length + 1, prompt: "", options: [], start: paragraph.index, end: paragraph.index };
    current.prompt = `${current.prompt} ${text}`.trim();
    current.end = paragraph.index;
  }
  flush();
  return items;
}

function parseNumberedOrBlockItems(paragraphs, block, { completion = false } = {}) {
  const items = [];
  let current = null;
  const flush = () => {
    if (!current) return;
    if (current.lines.length) {
      items.push({
        ordinal: current.ordinal ?? items.length + 1,
        text: current.lines.join(" ").trim(),
        source: trace(current.start, current.end),
      });
    }
    current = null;
  };
  const isCompletionBoundary = (text) => /^(?:照样子|请仿照|通过析字|请阅读下面|在下面一段文字)/.test(text);

  for (const paragraph of paragraphs.slice(block.start + 1, block.end)) {
    const text = paragraph.text.trim();
    if (!text || (!completion && isInstructionText(text))) continue;
    const numbered = numberedStart(text);
    const startsUnnumberedCompletion = completion && isCompletionBoundary(text);
    if (numbered || startsUnnumberedCompletion) {
      flush();
      current = {
        ordinal: numbered?.ordinal ?? items.length + 1,
        lines: [numbered?.text || text],
        start: paragraph.index,
        end: paragraph.index,
      };
      continue;
    }
    if (!current) {
      current = { ordinal: items.length + 1, lines: [stripOrdinal(text)], start: paragraph.index, end: paragraph.index };
    } else {
      current.lines.push(stripOrdinal(text));
      current.end = paragraph.index;
    }
  }
  flush();
  return items;
}

function parsePictureWordItems(paragraphs, block) {
  const items = [];
  let lines = [];
  let start = null;
  for (const paragraph of paragraphs.slice(block.start + 1, block.end)) {
    const text = paragraph.text.trim();
    if (text) {
      if (start === null) start = paragraph.index;
      lines.push(stripOrdinal(text));
    }
    if (paragraph.rids.length) {
      items.push({
        ordinal: items.length + 1,
        text: lines.join(" ").trim() || "根据图片提示作答",
        rids: [...paragraph.rids],
        source: trace(start ?? paragraph.index, paragraph.index),
      });
      lines = [];
      start = null;
    }
  }
  return items;
}

function parseBlockItems(paragraphs, block) {
  const body = paragraphs.slice(block.start + 1, block.end);
  const { family } = block.family;
  if (family === "LISTEN_IMAGE_CHOICE") {
    const audioParagraphs = body.filter((paragraph) => /^(?:\d+\s*[.．、)]\s*)?音频[：:]/.test(paragraph.text.trim()));
    return audioParagraphs.map((audio, ordinalIndex) => {
      const next = audioParagraphs[ordinalIndex + 1];
      const group = body.filter((paragraph) => paragraph.index >= audio.index && paragraph.index < (next?.index ?? block.end));
      const optionParagraph = group.find((paragraph) => paragraph.rids.length);
      return {
        ordinal: ordinalIndex + 1,
        text: audio.text.replace(/^\s*\d+\s*[.．、)]\s*/, "").replace(/^音频[：:]\s*/, "").trim(),
        options: optionParagraph?.rids.map((rid, index) => ({ key: "ABCD"[index], sourceWordImage: rid })) ?? [],
        rids: optionParagraph?.rids ?? [],
        source: trace(audio.index, group.at(-1)?.index ?? audio.index),
      };
    });
  }
  if (family === "DICTATION" || family === "READ_ALOUD") {
    return body
      .filter((paragraph) => paragraph.text.trim() && !isInstructionText(paragraph.text.trim()))
      .map((paragraph, index) => ({
        ordinal: index + 1,
        text: stripOrdinal(paragraph.text.trim()),
        source: trace(paragraph.index, paragraph.index),
      }));
  }
  if (family === "PICTURE_SPEAKING") {
    const meaningful = body.filter((paragraph) => paragraph.text.trim() || paragraph.rids.length);
    if (!meaningful.length) return [];
    return [{
      ordinal: 1,
      text: meaningful.filter((paragraph) => paragraph.text.trim()).map((paragraph) => paragraph.text.trim()).join(" "),
      rids: meaningful.flatMap((paragraph) => paragraph.rids),
      source: trace(meaningful[0].index, meaningful.at(-1).index),
    }];
  }
  if (family === "WORD_RECOGNITION" || family === "SENTENCE_COMPREHENSION") {
    return parseChoiceItems(paragraphs, block);
  }
  if (family === "PICTURE_WORD") return parsePictureWordItems(paragraphs, block);
  if (family === "SENTENCE_COMPLETION") return parseNumberedOrBlockItems(paragraphs, block, { completion: true });
  return [];
}

function makeItem(level, block, parsed) {
  const maxScore = expected[block.family.family][1];
  const content = parsed.text ?? parsed.prompt ?? "";
  const sourceImageRids = parsed.rids ?? parsed.options?.map((option) => option.sourceWordImage).filter(Boolean) ?? [];
  const deliveryOptions = parsed.options?.map((option) => ({ key: option.key, ...(option.text ? { text: option.text } : {}) })) ?? [];
  const deliverySpec = {
    instruction: block.family.label,
    stimulus: visualFamilies.has(block.family.family)
      ? { type: "IMAGE" }
      : block.family.domain === "LISTEN"
        ? { type: "AUDIO" }
        : { type: "TEXT", promptText: content },
    response: choiceFamilies.has(block.family.family)
      ? { type: "CHOICE", options: deliveryOptions }
      : speechFamilies.has(block.family.family)
        ? { type: "SPEECH" }
        : { type: "TEXT" },
  };
  if (block.family.family === "PICTURE_SPEAKING") deliverySpec.stimulus.promptText = content;
  if (block.family.family === "PICTURE_WORD") deliverySpec.stimulus.promptText = content;
  if (block.family.family === "LISTEN_IMAGE_CHOICE") deliverySpec.stimulus.promptText = content;
  return {
    stableKey: `L${level}-${block.family.domain}-${block.family.family}-${String(parsed.ordinal).padStart(3, "0")}`,
    level,
    domain: block.family.domain,
    family: block.family.family,
    sourceOrder: parsed.ordinal,
    maxScore,
    deliverySpec,
    scoringSpec: { strategy: strategy(block.family.family), maxScore },
    mediaBindings: { imageRids: sourceImageRids, images: [] },
    sourceTrace: { questionDocx: { familyLabel: block.family.label, ...parsed.source } },
  };
}

export function parseQuestionDocument(doc) {
  return levelRanges(doc.paragraphs).map((range) => {
    const questions = familyBlocks(doc.paragraphs, range).flatMap((block) => (
      parseBlockItems(doc.paragraphs, { ...block, family: block.family }).map((parsed) => makeItem(range.level, block, parsed))
    ));
    return {
      level: range.level,
      sections: ["LISTEN", "SPEAK", "READ", "WRITE"].map((domain) => ({
        domain,
        families: questions.filter((question) => question.domain === domain),
      })),
      questions,
    };
  });
}

function cleanAnswerText(text) {
  return text.replace(/^\s*(?:参考答案|答案|下联)\s*[：:]\s*/, "").trim();
}

function numberedAnswerEntries(paragraphs, family) {
  const entries = [];
  for (const paragraph of paragraphs) {
    const text = paragraph.text.trim();
    if (!text || text === "无") continue;
    if (choiceFamilies.has(family) && !/^\s*\d/.test(text)) {
      const matches = [...text.matchAll(/(?:^|\s)(?:(\d+)\s*[.．、)]\s*)?([A-D])(?=\s|[.．、:：]|$)/g)];
      if (matches.length) {
        for (const match of matches) entries.push({
          ordinal: Number(match[1] ?? entries.length + 1),
          value: match[2],
          source: trace(paragraph.index, paragraph.index),
        });
        continue;
      }
    }
    const markers = [...text.matchAll(/(?:^|\s)(\d+)\s*[.．、)]\s*/g)];
    if (markers.length) {
      for (const [index, marker] of markers.entries()) entries.push({
        ordinal: Number(marker[1]),
        value: cleanAnswerText(text.slice(marker.index + marker[0].length, markers[index + 1]?.index ?? text.length)),
        source: trace(paragraph.index, paragraph.index),
      });
      continue;
    }
    if (choiceFamilies.has(family)) {
      const matches = [...text.matchAll(/(?:^|\s)([A-D])(?=\s|[.．、:：]|$)/g)];
      if (matches.length) {
        for (const match of matches) entries.push({
          ordinal: entries.length + 1,
          value: match[1],
          source: trace(paragraph.index, paragraph.index),
        });
        continue;
      }
    }
    if (family === "PICTURE_SPEAKING" && /^参考示例[：:]/.test(text)) {
      entries.push({ ordinal: 1, value: cleanAnswerText(text.replace(/^参考示例[：:]\s*/, "")), source: trace(paragraph.index, paragraph.index) });
    } else if (!choiceFamilies.has(family) && family !== "READ_ALOUD") {
      entries.push({ ordinal: entries.length + 1, value: cleanAnswerText(text), source: trace(paragraph.index, paragraph.index) });
    }
  }
  return entries;
}

function parseAnswerGroups(paragraphs, ranges) {
  const groups = [];
  for (const range of ranges) {
    for (const block of familyBlocks(paragraphs, range)) {
      const body = paragraphs.slice(block.start + 1, block.end);
      groups.push({
        level: range.level,
        family: block.family.family,
        label: block.family.label,
        entries: numberedAnswerEntries(body, block.family.family),
        source: trace(block.start, Math.max(block.start, block.end - 1)),
      });
    }
  }
  return groups;
}

function parseRubrics(paragraphs) {
  const rubricStart = paragraphs.findIndex((paragraph) => paragraph.text.trim() === "评分细则");
  if (rubricStart < 0) return [];
  const starts = [];
  for (let i = rubricStart + 1; i < paragraphs.length; i += 1) {
    const family = familyFromText(paragraphs[i].text);
    if (family) starts.push({ start: i, family });
  }
  return starts.map((entry, index) => {
    const end = starts[index + 1]?.start ?? paragraphs.length;
    const lines = paragraphs.slice(entry.start + 1, end).map((paragraph) => paragraph.text.trim()).filter(Boolean);
    return {
      family: entry.family.family,
      source: trace(entry.start, Math.max(entry.start, end - 1)),
      rubric: lines,
      deductionRules: lines.filter((line) => /扣|不得分/.test(line)),
    };
  });
}

export function parseAnswerDocument(doc) {
  const ranges = levelRanges(doc.paragraphs);
  return {
    levels: ranges.map((range) => range.level),
    groups: parseAnswerGroups(doc.paragraphs, ranges),
    rubrics: parseRubrics(doc.paragraphs),
  };
}

function referenceForQuestion(question, entry) {
  if (entry) return entry.value;
  if (question.family === "READ_ALOUD") return null;
  return undefined;
}

export function bindAnswerGroups(levelsToBind, answerDocument, issues = []) {
  const answerGroups = answerDocument.groups ?? [];
  const rubrics = answerDocument.rubrics ?? [];
  for (const level of levelsToBind) {
    for (const question of level.questions) {
      const matches = answerGroups.filter((group) => group.level === question.level && group.family === question.family);
      if (!matches.length) {
        addIssue(issues, "ERROR", "ANSWER_MISSING", { level: question.level, family: question.family, sourceOrder: question.sourceOrder });
        continue;
      }
      if (matches.length > 1) {
        addIssue(issues, "ERROR", "ANSWER_AMBIGUOUS", { level: question.level, family: question.family, sourceOrder: question.sourceOrder });
        continue;
      }
      const group = matches[0];
      const entries = group.entries.filter((entry) => entry.ordinal === question.sourceOrder);
      const rubricMatches = rubrics.filter((rubric) => rubric.family === question.family);
      if (entries.length > 1) {
        addIssue(issues, "ERROR", "ANSWER_AMBIGUOUS", { level: question.level, family: question.family, sourceOrder: question.sourceOrder });
        continue;
      }
      if (!entries.length && !(question.family === "READ_ALOUD" && group.entries.length === 0)) {
        addIssue(issues, "ERROR", "ANSWER_MISSING", { level: question.level, family: question.family, sourceOrder: question.sourceOrder });
        continue;
      }
      const entry = entries[0];
      if (choiceFamilies.has(question.family) && entry && !/^[A-D]$/.test(entry.value)) {
        addIssue(issues, "ERROR", "INVALID_ANSWER_OPTION", { level: question.level, family: question.family, sourceOrder: question.sourceOrder, value: entry.value });
        continue;
      }
      const rubric = rubricMatches[0];
      const referenceAnswer = referenceForQuestion(question, entry);
      question.scoringSpec = {
        ...question.scoringSpec,
        ...(question.family === "READ_ALOUD" ? { targetText: question.deliverySpec.stimulus.promptText } : {}),
        referenceAnswer,
        rubric: rubric?.rubric ?? [],
        deductionRules: rubric?.deductionRules ?? [],
        sourceTrace: {
          answerDocx: {
            answerGroup: { canonicalFamily: group.family, sourceOrder: question.sourceOrder, ...group.source },
            referenceAnswer: entry?.source ?? null,
            rubric: rubric?.source ?? null,
          },
        },
      };
      question.scoringBinding = {
        status: "BOUND",
        level: question.level,
        family: question.family,
        sourceOrder: question.sourceOrder,
      };
    }
  }
  return levelsToBind;
}

export function scoringSummary(levelsToSummarize) {
  const questions = levelsToSummarize.flatMap((level) => level.questions);
  return {
    items: questions.length,
    points: questions.reduce((total, question) => total + question.maxScore, 0),
    bound: questions.filter((question) => question.scoringBinding?.status === "BOUND").length,
    missing: questions.filter((question) => !question.scoringBinding || question.scoringBinding.status === "MISSING").length,
    ambiguous: questions.filter((question) => question.scoringBinding?.status === "AMBIGUOUS").length,
  };
}

export function selectLevels(allLevels, level) {
  return level ? allLevels.filter((entry) => entry.level === level) : allLevels;
}

export function validateQuestions(levelsToValidate, issues = []) {
  for (const level of levelsToValidate) {
    for (const [family, [count]] of Object.entries(expected)) {
      const actual = level.questions.filter((question) => question.family === family).length;
      if (actual !== count) addIssue(issues, "ERROR", "QUESTION_COUNT_MISMATCH", { level: level.level, family, expected: count, actual });
    }
    const total = level.questions.reduce((sum, question) => sum + question.maxScore, 0);
    if (total !== 100) addIssue(issues, "ERROR", "POINT_TOTAL_MISMATCH", { level: level.level, expected: 100, actual: total });
    for (const question of level.questions) {
      if (/correctanswer|acceptedanswers|referenceanswer|rubric|deductionrules|scoringspec/i.test(JSON.stringify(question.deliverySpec))) {
        addIssue(issues, "ERROR", "DELIVERY_SCORING_LEAK", { level: question.level, family: question.family, sourceOrder: question.sourceOrder });
      }
    }
  }
  return issues;
}

export async function inventory(zip) {
  const result = [];
  for (const zipPath of (await zipNames(zip)).filter((entry) => !entry.endsWith("/"))) {
    const buffer = await zipRead(zip, zipPath);
    const extension = path.extname(zipPath).slice(1).toLowerCase();
    const mediaType = ["jpg", "jpeg", "png"].includes(extension)
      ? "IMAGE"
      : ["mp3", "wav", "m4a"].includes(extension)
        ? "AUDIO"
        : "OTHER";
    const level = chineseLevels[(zipPath.match(/水平([一二三四五六])级/) || [])[1]];
    result.push({ zipPath, filename: path.basename(zipPath), extension, size: buffer.length, mediaType, level, sha256: hash(buffer) });
  }
  return result;
}

export async function imageFingerprint(buffer) {
  const { data } = await sharp(buffer).resize(16, 16, { fit: "fill" }).grayscale().raw().toBuffer({ resolveWithObject: true });
  const average = data.reduce((sum, value) => sum + value, 0) / data.length;
  return [...data].map((value) => (value >= average ? 1 : 0));
}

export function hammingDistance(left, right) {
  return left.reduce((sum, value, index) => sum + (value !== right[index] ? 1 : 0), 0);
}

export function matchImageOccurrence(source, candidates, { threshold = 30, margin = 2 } = {}) {
  const exact = candidates.filter((candidate) => candidate.sha256 && candidate.sha256 === source.sha256);
  if (exact.length === 1) return { status: "MATCH", candidate: exact[0], match: "exact", distance: 0 };
  if (exact.length > 1) return { status: "AMBIGUOUS", candidates: exact, reason: "duplicate-exact" };
  if (!candidates.length) return { status: "UNMATCHED", reason: "no-candidates" };
  const ranked = candidates
    .map((candidate) => ({ candidate, distance: hammingDistance(source.fp, candidate.fp) }))
    .sort((left, right) => left.distance - right.distance);
  if (ranked[0].distance > threshold) return { status: "UNMATCHED", ranked };
  if (ranked[1] && ranked[0].distance + margin >= ranked[1].distance) return { status: "AMBIGUOUS", ranked };
  return { status: "MATCH", candidate: ranked[0].candidate, match: "perceptual", distance: ranked[0].distance };
}

function audioCandidates(media, question) {
  const scope = question.family === "DICTATION" ? "听写句子" : "听音选图";
  const ordinal = String(question.sourceOrder);
  return media.filter((entry) => {
    if (entry.mediaType !== "AUDIO" || entry.level !== question.level || !entry.zipPath.includes(scope)) return false;
    return new RegExp(`^${ordinal}(?=[.．、\\s]|[^0-9])`).test(entry.filename);
  });
}

export function bindAudio(question, media, issues = []) {
  const candidates = audioCandidates(media, question);
  if (candidates.length !== 1) {
    addIssue(issues, "ERROR", candidates.length ? "AUDIO_AMBIGUOUS" : "MEDIA_MISSING", {
      level: question.level,
      family: question.family,
      sourceOrder: question.sourceOrder,
    });
    return null;
  }
  question.mediaBindings.audio = {
    kind: "AUDIO",
    zipPath: candidates[0].zipPath,
    sha256: candidates[0].sha256,
  };
  return candidates[0];
}

export async function bindMedia(levelsToBind, questionDoc, options, media, issues = []) {
  const sourceImages = new Map();
  for (const occurrence of questionDoc.occurrences) {
    if (!occurrence.entry) continue;
    const buffer = await zipRead(options.questions, occurrence.entry);
    sourceImages.set(occurrence.rid, {
      occurrence: occurrence.occurrence,
      sha256: hash(buffer),
      fp: await imageFingerprint(buffer),
    });
  }
  const imageCandidates = [];
  for (const entry of media.filter((item) => item.mediaType === "IMAGE")) {
    imageCandidates.push({ ...entry, fp: await imageFingerprint(await zipRead(options.media, entry.zipPath)) });
  }
  for (const level of levelsToBind) {
    for (const question of level.questions) {
      const rids = question.mediaBindings.imageRids ?? [];
      const imageRids = question.family === "PICTURE_SPEAKING" || question.family === "PICTURE_WORD"
        ? question.sourceTrace.questionDocx.paragraphStart <= question.sourceTrace.questionDocx.paragraphEnd
          ? questionDoc.paragraphs
            .filter((paragraph) => paragraph.index >= question.sourceTrace.questionDocx.paragraphStart && paragraph.index <= question.sourceTrace.questionDocx.paragraphEnd)
            .flatMap((paragraph) => paragraph.rids)
          : []
        : rids;
      for (const rid of imageRids) {
        const source = sourceImages.get(rid);
        if (!source) {
          addIssue(issues, "ERROR", "IMAGE_UNMATCHED", { level: question.level, family: question.family, sourceOccurrence: rid });
          continue;
        }
        const matched = matchImageOccurrence(source, imageCandidates);
        if (matched.status !== "MATCH") {
          addIssue(issues, "ERROR", matched.status === "AMBIGUOUS" ? "IMAGE_AMBIGUOUS" : "IMAGE_UNMATCHED", {
            level: question.level,
            family: question.family,
            sourceOccurrence: source.occurrence,
          });
          continue;
        }
        question.mediaBindings.images.push({
          kind: "IMAGE",
          zipPath: matched.candidate.zipPath,
          sha256: matched.candidate.sha256,
          sourceOccurrence: source.occurrence,
          match: matched.match,
        });
      }
      if (question.family === "LISTEN_IMAGE_CHOICE" || question.family === "DICTATION") bindAudio(question, media, issues);
      delete question.mediaBindings.imageRids;
    }
  }
  return levelsToBind;
}

function args(values) {
  const result = { ...defaults };
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === "--all") result.all = true;
    else if (values[index] === "--level") result.level = Number(values[++index]);
  }
  return result;
}

function filteredIssues(issues, level) {
  return issues.filter((issue) => !level || issue.level === level);
}

export async function run(options = args(process.argv.slice(2))) {
  const issues = [];
  const [questionDoc, answerDoc, media] = await Promise.all([
    readDocx(options.questions),
    readDocx(options.answers),
    inventory(options.media),
  ]);
  const allLevels = parseQuestionDocument(questionDoc);
  const parsedAnswers = parseAnswerDocument(answerDoc);
  bindAnswerGroups(allLevels, parsedAnswers, issues);
  await bindMedia(allLevels, questionDoc, options, media, issues);
  validateQuestions(allLevels, issues);
  const chosenLevels = selectLevels(allLevels, options.level);
  const relevant = filteredIssues(issues, options.level);
  const summary = scoringSummary(chosenLevels);
  const report = {
    mode: "DRY RUN — NO DATABASE WRITE — NO MINIO WRITE",
    questionDocx: {
      levels: allLevels.length,
      embeddedImages: questionDoc.occurrences.length,
      parsedItems: allLevels.reduce((sum, level) => sum + level.questions.length, 0),
    },
    answerDocx: {
      levels: parsedAnswers.levels.length,
      groups: parsedAnswers.groups.length,
    },
    media: {
      totalFiles: media.length,
      images: media.filter((entry) => entry.mediaType === "IMAGE").length,
      audio: media.filter((entry) => entry.mediaType === "AUDIO").length,
      byLevel: Object.fromEntries([1, 2, 3, 4, 5, 6].map((level) => [level, {
        images: media.filter((entry) => entry.level === level && entry.mediaType === "IMAGE").length,
        audio: media.filter((entry) => entry.level === level && entry.mediaType === "AUDIO").length,
      }])),
    },
    selectedLevel: options.level ?? null,
    summary,
    validation: {
      errors: relevant.filter((issue) => issue.severity === "ERROR").length,
      warnings: relevant.filter((issue) => issue.severity === "WARNING").length,
    },
    issues: relevant,
  };
  await mkdir(options.output, { recursive: true });
  await Promise.all([
    writeFile(path.join(options.output, "manifest.json"), JSON.stringify({
      schemaVersion: 1,
      source: { questions: options.questions, answers: options.answers, media: options.media },
      levels: chosenLevels,
      issues: relevant,
    }, null, 2)),
    writeFile(path.join(options.output, "validation-report.json"), JSON.stringify(report, null, 2)),
    writeFile(path.join(options.output, "media-inventory.json"), JSON.stringify(media, null, 2)),
  ]);
  console.log(`QB source validator\n${report.mode}`);
  console.log(`Parsed items: ${report.questionDocx.parsedItems}`);
  console.log(`Media: ${report.media.totalFiles} files (${report.media.images} images, ${report.media.audio} audio)`);
  console.log(`Selected: ${summary.items} items, ${summary.points} points, scoring binding ${summary.bound}/${summary.items} (missing ${summary.missing}, ambiguous ${summary.ambiguous})`);
  console.log(`Validation: errors ${report.validation.errors}, warnings ${report.validation.warnings}`);
  for (const issue of relevant.filter((entry) => entry.severity === "ERROR")) {
    console.log(`ERROR L${issue.level ?? "?"} / ${issue.family ?? "SOURCE"} ${issue.code}${issue.expected !== undefined ? ` expected ${issue.expected} actual ${issue.actual}` : ""}`);
  }
  return { report, manifest: { levels: chosenLevels, issues: relevant }, issues };
}

if (import.meta.main) {
  run().then(({ report }) => { process.exitCode = report.validation.errors ? 1 : 0; })
    .catch((error) => { console.error(error); process.exitCode = 1; });
}
