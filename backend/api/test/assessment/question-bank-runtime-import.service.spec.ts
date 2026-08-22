import { describe, expect, it } from "vitest";
import {
  resolveQuestion,
  type CanonicalQuestion,
} from "../../src/modules/assessment/question-bank-runtime-import.service.js";

const sourceDocuments = {
  questionDocx: { fileName: "questions.docx", sha256: "a".repeat(64) },
  answerDocx: { fileName: "answers.docx", sha256: "b".repeat(64) },
  mediaArchive: { fileName: "media.zip", sha256: "c".repeat(64) },
};

function listenImageQuestion(): CanonicalQuestion {
  return {
    stableKey: "L1-LISTEN-LISTEN_IMAGE_CHOICE-001",
    level: 1,
    domain: "LISTEN",
    family: "LISTEN_IMAGE_CHOICE",
    sourceOrder: 1,
    maxScore: 3,
    deliverySpec: {
      instruction: "听音选图",
      stimulus: { type: "AUDIO", promptText: "大树" },
      response: { type: "CHOICE", options: [{ key: "A" }, { key: "B" }, { key: "C" }, { key: "D" }] },
    },
    scoringSpec: {
      strategy: "EXACT_CHOICE",
      maxScore: 3,
      referenceAnswer: "A",
      sourceTrace: { answerDocx: { paragraphStart: 4, paragraphEnd: 5 } },
    },
    scoringBinding: { status: "BOUND" },
    mediaBindings: {
      audio: { kind: "AUDIO", zipPath: "水平一级/听音选图/音频/1.mp3", sha256: "1".repeat(64) },
      images: [
        { kind: "IMAGE", zipPath: "水平一级/听音选图/图片/a.jpg", sha256: "2".repeat(64), sourceOccurrence: 4 },
        { kind: "IMAGE", zipPath: "水平一级/听音选图/图片/b.jpg", sha256: "3".repeat(64), sourceOccurrence: 5 },
        { kind: "IMAGE", zipPath: "水平一级/听音选图/图片/c.jpg", sha256: "4".repeat(64), sourceOccurrence: 6 },
        { kind: "IMAGE", zipPath: "水平一级/听音选图/图片/d.jpg", sha256: "5".repeat(64), sourceOccurrence: 7 },
      ],
    },
    sourceTrace: { questionDocx: { paragraphStart: 4, paragraphEnd: 6 } },
  };
}

describe("Question Bank runtime import delivery conversion", () => {
  it("uses Resource IDs while preserving authored A/B/C/D option order", () => {
    const ids = new Map([
      ["AUDIO:" + "1".repeat(64), "audio-resource"],
      ["IMAGE:" + "2".repeat(64), "image-a"],
      ["IMAGE:" + "3".repeat(64), "image-b"],
      ["IMAGE:" + "4".repeat(64), "image-c"],
      ["IMAGE:" + "5".repeat(64), "image-d"],
    ]);
    const resolved = resolveQuestion(listenImageQuestion(), ids, sourceDocuments);
    const delivery = resolved.deliverySpec as {
      stimulus: { resourceId?: string };
      response: { options: Array<{ key: string; imageResourceId?: string }> };
    };

    expect(delivery.stimulus.resourceId).toBe("audio-resource");
    expect(delivery.response.options).toEqual([
      { key: "A", imageResourceId: "image-a" },
      { key: "B", imageResourceId: "image-b" },
      { key: "C", imageResourceId: "image-c" },
      { key: "D", imageResourceId: "image-d" },
    ]);
    const serializedDelivery = JSON.stringify(delivery);
    expect(serializedDelivery).not.toContain("zipPath");
    expect(serializedDelivery).not.toContain("sourceOccurrence");
    expect(serializedDelivery).not.toContain("local_sources");
    expect(resolved.sourceTrace).toMatchObject({
      sourceDocuments,
      questionDocx: { paragraphStart: 4, paragraphEnd: 6 },
      answerDocx: { paragraphStart: 4, paragraphEnd: 5 },
    });
  });

  it("fails closed if a local import path reaches deliverySpec", () => {
    const question = listenImageQuestion();
    (question.deliverySpec.stimulus as { promptText: string }).promptText = "/home/test/local_sources/question-bank/private.png";
    const ids = new Map([
      ["AUDIO:" + "1".repeat(64), "audio-resource"],
      ["IMAGE:" + "2".repeat(64), "image-a"],
      ["IMAGE:" + "3".repeat(64), "image-b"],
      ["IMAGE:" + "4".repeat(64), "image-c"],
      ["IMAGE:" + "5".repeat(64), "image-d"],
    ]);
    expect(() => resolveQuestion(question, ids, sourceDocuments)).toThrow("local source path");
  });
});
