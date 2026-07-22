import { describe, expect, it } from "vitest";
import {
  canTransition,
  validateTransition,
  isOpen,
  isReviewable,
} from "../../../src/modules/submissions/domain/submission.state-machine.js";

describe("Submission State Machine", () => {
  describe("canTransition", () => {
    const validTransitions: [string, string][] = [
      ["IN_PROGRESS", "PENDING_SYNC"],
      ["IN_PROGRESS", "SUBMITTED"],
      ["PENDING_SYNC", "SUBMITTED"],
      ["SUBMITTED", "PROCESSING"],
      ["PROCESSING", "NEEDS_REVIEW"],
      ["NEEDS_REVIEW", "REVIEWED"],
      ["REVIEWED", "RETURNED"],
      ["REVIEWED", "ACCEPTED"],
      ["RETURNED", "IN_PROGRESS"],
      ["RETURNED", "SUBMITTED"],
    ];

    it.each(validTransitions)("allows %s -> %s", (from, to) => {
      expect(canTransition(from as never, to as never)).toBe(true);
    });

    const invalidTransitions: [string, string][] = [
      ["IN_PROGRESS", "PROCESSING"],
      ["IN_PROGRESS", "NEEDS_REVIEW"],
      ["IN_PROGRESS", "REVIEWED"],
      ["IN_PROGRESS", "ACCEPTED"],
      ["PENDING_SYNC", "IN_PROGRESS"],
      ["PENDING_SYNC", "PROCESSING"],
      ["SUBMITTED", "IN_PROGRESS"],
      ["SUBMITTED", "NEEDS_REVIEW"],
      ["PROCESSING", "SUBMITTED"],
      ["PROCESSING", "REVIEWED"],
      ["NEEDS_REVIEW", "IN_PROGRESS"],
      ["NEEDS_REVIEW", "SUBMITTED"],
      ["REVIEWED", "IN_PROGRESS"],
      ["REVIEWED", "PROCESSING"],
      ["ACCEPTED", "IN_PROGRESS"],
      ["ACCEPTED", "SUBMITTED"],
      ["ACCEPTED", "RETURNED"],
      ["RETURNED", "PROCESSING"],
      ["RETURNED", "NEEDS_REVIEW"],
    ];

    it.each(invalidTransitions)("rejects %s -> %s", (from, to) => {
      expect(canTransition(from as never, to as never)).toBe(false);
    });
  });

  describe("validateTransition", () => {
    it("passes for valid transition", () => {
      expect(() => validateTransition("IN_PROGRESS", "SUBMITTED")).not.toThrow();
    });

    it("throws for invalid transition", () => {
      expect(() => validateTransition("IN_PROGRESS", "PROCESSING")).toThrow();
    });
  });

  describe("isOpen", () => {
    it("returns true for IN_PROGRESS and SUBMITTED", () => {
      expect(isOpen("IN_PROGRESS")).toBe(true);
      expect(isOpen("SUBMITTED")).toBe(true);
    });

    it("returns false for other statuses", () => {
      for (const status of ["PENDING_SYNC", "PROCESSING", "NEEDS_REVIEW", "REVIEWED", "RETURNED", "ACCEPTED"] as const) {
        expect(isOpen(status)).toBe(false);
      }
    });
  });

  describe("isReviewable", () => {
    it("returns true for NEEDS_REVIEW and REVIEWED", () => {
      expect(isReviewable("NEEDS_REVIEW")).toBe(true);
      expect(isReviewable("REVIEWED")).toBe(true);
    });

    it("returns false for other statuses", () => {
      for (const status of ["IN_PROGRESS", "PENDING_SYNC", "SUBMITTED", "PROCESSING", "RETURNED", "ACCEPTED"] as const) {
        expect(isReviewable(status)).toBe(false);
      }
    });
  });
});
