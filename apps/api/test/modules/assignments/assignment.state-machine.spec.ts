import { describe, expect, it } from "vitest";
import {
  canTransition,
  validateTransition,
  isOpen,
  isClosed,
} from "../../../src/modules/assignments/domain/assignment.state-machine.js";
import { AssignmentStatusException } from "../../../src/modules/assignments/domain/assignment.errors.js";

describe("Assignment State Machine", () => {
  describe("canTransition", () => {
    const validTransitions: [string, string][] = [
      ["DRAFT", "SCHEDULED"],
      ["DRAFT", "CANCELLED"],
      ["SCHEDULED", "OPEN"],
      ["SCHEDULED", "CANCELLED"],
      ["OPEN", "CLOSED"],
      ["OPEN", "CANCELLED"],
      ["CLOSED", "ARCHIVED"],
      ["CANCELLED", "ARCHIVED"],
    ];

    it.each(validTransitions)("allows %s -> %s", (from, to) => {
      expect(canTransition(from as never, to as never)).toBe(true);
    });

    const invalidTransitions: [string, string][] = [
      ["DRAFT", "OPEN"],
      ["DRAFT", "CLOSED"],
      ["DRAFT", "ARCHIVED"],
      ["SCHEDULED", "DRAFT"],
      ["SCHEDULED", "CLOSED"],
      ["SCHEDULED", "ARCHIVED"],
      ["OPEN", "DRAFT"],
      ["OPEN", "SCHEDULED"],
      ["OPEN", "ARCHIVED"],
      ["CLOSED", "DRAFT"],
      ["CLOSED", "OPEN"],
      ["CLOSED", "CANCELLED"],
      ["CANCELLED", "DRAFT"],
      ["CANCELLED", "OPEN"],
      ["CANCELLED", "CLOSED"],
      ["ARCHIVED", "DRAFT"],
      ["ARCHIVED", "OPEN"],
      ["ARCHIVED", "CLOSED"],
      ["ARCHIVED", "CANCELLED"],
    ];

    it.each(invalidTransitions)("rejects %s -> %s", (from, to) => {
      expect(canTransition(from as never, to as never)).toBe(false);
    });
  });

  describe("validateTransition", () => {
    it("passes for valid transition", () => {
      expect(() => validateTransition("DRAFT", "SCHEDULED")).not.toThrow();
    });

    it("throws AssignmentStatusException for invalid transition", () => {
      expect(() => validateTransition("DRAFT", "OPEN")).toThrow(
        AssignmentStatusException,
      );
    });

    it("includes from/to in error message", () => {
      expect(() => validateTransition("OPEN", "DRAFT")).toThrow(/DRAFT/);
    });
  });

  describe("isOpen", () => {
    it("returns true for OPEN", () => {
      expect(isOpen("OPEN")).toBe(true);
    });

    it("returns false for other statuses", () => {
      for (const status of ["DRAFT", "SCHEDULED", "CLOSED", "CANCELLED", "ARCHIVED"] as const) {
        expect(isOpen(status)).toBe(false);
      }
    });
  });

  describe("isClosed", () => {
    it("returns true for terminal statuses", () => {
      expect(isClosed("CLOSED")).toBe(true);
      expect(isClosed("CANCELLED")).toBe(true);
      expect(isClosed("ARCHIVED")).toBe(true);
    });

    it("returns false for active statuses", () => {
      for (const status of ["DRAFT", "SCHEDULED", "OPEN"] as const) {
        expect(isClosed(status)).toBe(false);
      }
    });
  });
});
