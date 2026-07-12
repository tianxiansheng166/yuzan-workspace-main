import { describe, expect, it } from "vitest";
import { detectConflicts } from "../../src/modules/product-plans/rules/conflict-detector.js";
import { recommendationRule } from "./fixtures/rules.js";

describe("detectConflicts", () => {
  it("returns empty array for empty input", () => {
    const conflicts = detectConflicts([]);
    expect(conflicts).toEqual([]);
  });

  it("returns empty array for single rule", () => {
    const rule = recommendationRule();
    const conflicts = detectConflicts([rule]);
    expect(conflicts).toEqual([]);
  });

  it("finds no conflicts when rules have different issueCode", () => {
    const ruleA = recommendationRule({ issueCode: "ANXIETY" });
    const ruleB = recommendationRule({ issueCode: "DEPRESSION" });
    const conflicts = detectConflicts([ruleA, ruleB]);
    expect(conflicts).toEqual([]);
  });

  it("finds no conflicts when rules have different dimensionCode", () => {
    const ruleA = recommendationRule({ dimensionCode: "EMOTIONAL" });
    const ruleB = recommendationRule({ dimensionCode: "COGNITIVE" });
    const conflicts = detectConflicts([ruleA, ruleB]);
    expect(conflicts).toEqual([]);
  });

  it("finds no conflicts when rules have different priority", () => {
    const ruleA = recommendationRule({ priority: 1 });
    const ruleB = recommendationRule({ priority: 2 });
    const conflicts = detectConflicts([ruleA, ruleB]);
    expect(conflicts).toEqual([]);
  });

  it("finds no conflict with non-overlapping severity ranges", () => {
    const ruleA = recommendationRule({ severityMin: 1, severityMax: 3, priority: 1 });
    const ruleB = recommendationRule({ severityMin: 4, severityMax: 6, priority: 1 });
    const conflicts = detectConflicts([ruleA, ruleB]);
    expect(conflicts).toEqual([]);
  });

  it("finds FULL_OVERLAP when same severity range and same priority", () => {
    const ruleA = recommendationRule({
      issueCode: "ANXIETY",
      dimensionCode: "EMOTIONAL",
      severityMin: 1,
      severityMax: 5,
      priority: 1,
    });
    const ruleB = recommendationRule({
      issueCode: "ANXIETY",
      dimensionCode: "EMOTIONAL",
      severityMin: 1,
      severityMax: 5,
      priority: 1,
    });
    const conflicts = detectConflicts([ruleA, ruleB]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.conflictType).toBe("FULL_OVERLAP");
    expect(conflicts[0]!.ruleIdA).toBe(ruleA.id);
    expect(conflicts[0]!.ruleIdB).toBe(ruleB.id);
  });

  it("finds PRIORITY_OVERLAP when overlapping severity range and same priority", () => {
    const ruleA = recommendationRule({
      issueCode: "ANXIETY",
      dimensionCode: "EMOTIONAL",
      severityMin: 1,
      severityMax: 5,
      priority: 1,
    });
    const ruleB = recommendationRule({
      issueCode: "ANXIETY",
      dimensionCode: "EMOTIONAL",
      severityMin: 3,
      severityMax: 7,
      priority: 1,
    });
    const conflicts = detectConflicts([ruleA, ruleB]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.conflictType).toBe("PRIORITY_OVERLAP");
  });

  it("finds partial severity overlap as conflict", () => {
    const ruleA = recommendationRule({
      issueCode: "ANXIETY",
      dimensionCode: "EMOTIONAL",
      severityMin: 1,
      severityMax: 4,
      priority: 1,
    });
    const ruleB = recommendationRule({
      issueCode: "ANXIETY",
      dimensionCode: "EMOTIONAL",
      severityMin: 3,
      severityMax: 8,
      priority: 1,
    });
    const conflicts = detectConflicts([ruleA, ruleB]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.conflictType).toBe("PRIORITY_OVERLAP");
  });

  it("detects multiple conflicts across multiple rules", () => {
    const ruleA = recommendationRule({
      id: "rule-a",
      issueCode: "ANXIETY",
      dimensionCode: "EMOTIONAL",
      severityMin: 1,
      severityMax: 5,
      priority: 1,
    });
    const ruleB = recommendationRule({
      id: "rule-b",
      issueCode: "ANXIETY",
      dimensionCode: "EMOTIONAL",
      severityMin: 2,
      severityMax: 6,
      priority: 1,
    });
    const ruleC = recommendationRule({
      id: "rule-c",
      issueCode: "ANXIETY",
      dimensionCode: "EMOTIONAL",
      severityMin: 3,
      severityMax: 7,
      priority: 1,
    });
    const conflicts = detectConflicts([ruleA, ruleB, ruleC]);
    // A-B, A-C, B-C
    expect(conflicts).toHaveLength(3);
  });

  it("does not produce duplicate conflict pairs", () => {
    const ruleA = recommendationRule({
      issueCode: "ANXIETY",
      dimensionCode: "EMOTIONAL",
      severityMin: 1,
      severityMax: 5,
      priority: 1,
    });
    const ruleB = recommendationRule({
      issueCode: "ANXIETY",
      dimensionCode: "EMOTIONAL",
      severityMin: 1,
      severityMax: 5,
      priority: 1,
    });
    const conflicts = detectConflicts([ruleA, ruleB]);
    expect(conflicts).toHaveLength(1);
  });
});
