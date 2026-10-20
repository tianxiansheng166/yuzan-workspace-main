import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import {
  QuestionBankDraftInputDto,
  UpdateQuestionBankDraftDto,
} from "../../src/modules/assessment/dto/question-bank-draft.dto.js";

const common = {
  title: "关键词选择",
  prompt: "选出关键词。",
  domain: "READ",
  difficulty: "EASY",
  maxScore: 5,
};

describe("QuestionBank draft request validation", () => {
  it("accepts a valid choice draft", async () => {
    const dto = plainToInstance(QuestionBankDraftInputDto, {
      ...common,
      itemType: "CHOICE",
      options: [
        { key: "A", text: "甲" },
        { key: "B", text: "乙" },
      ],
      correctOption: "B",
    });
    expect(await validate(dto)).toEqual([]);
  });

  it("rejects a choice draft with missing or malformed options", async () => {
    const dto = plainToInstance(QuestionBankDraftInputDto, {
      ...common,
      itemType: "CHOICE",
      options: [{ key: "A", text: "" }],
      correctOption: "D",
    });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(["options"]),
    );
  });

  it("accepts text answers and rejects an unsupported item type", async () => {
    const textDto = plainToInstance(QuestionBankDraftInputDto, {
      ...common,
      itemType: "TEXT",
      acceptedAnswers: ["春天"],
    });
    const invalidDto = plainToInstance(QuestionBankDraftInputDto, {
      ...common,
      itemType: "SPEECH",
    });
    expect(await validate(textDto)).toEqual([]);
    expect(
      (await validate(invalidDto)).map((error) => error.property),
    ).toContain("itemType");
  });

  it("requires a positive integer expectedRevision for updates", async () => {
    const dto = plainToInstance(UpdateQuestionBankDraftDto, {
      ...common,
      itemType: "TEXT",
      acceptedAnswers: ["春天"],
      expectedRevision: 0,
    });
    expect((await validate(dto)).map((error) => error.property)).toContain(
      "expectedRevision",
    );
  });
});
