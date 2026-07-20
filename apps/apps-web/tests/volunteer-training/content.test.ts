import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_QUESTIONS,
  TRAINING_MATERIALS,
  TRAINING_MODULES,
} from "../../app/features/volunteer-training/content";

describe("volunteer training content", () => {
  it("covers required topic areas", () => {
    const titles = TRAINING_MODULES.map((module) => module.title);

    expect(titles).toContain("项目介绍");
    expect(titles).toContain("服务对象");
    expect(titles).toContain("教学沟通");
    expect(titles).toContain("未成年人保护");
    expect(titles).toContain("跨文化沟通");
    expect(titles).toContain("课堂协助和突发情况");
  });

  it("has non-empty content for every module", () => {
    for (const module of TRAINING_MODULES) {
      expect(module.id).toBeTruthy();
      expect(module.title).toBeTruthy();
      expect(module.summary).toBeTruthy();
      expect(module.content.length).toBeGreaterThan(0);
    }
  });

  it("has valid assessment questions", () => {
    for (const question of ASSESSMENT_QUESTIONS) {
      expect(question.options.length).toBeGreaterThan(1);
      expect(question.correctIndex).toBeGreaterThanOrEqual(0);
      expect(question.correctIndex).toBeLessThan(question.options.length);
    }
  });

  it("lists training materials", () => {
    expect(TRAINING_MATERIALS.length).toBeGreaterThan(0);
    for (const material of TRAINING_MATERIALS) {
      expect(material.title).toBeTruthy();
      expect(material.size).toBeTruthy();
    }
  });
});
