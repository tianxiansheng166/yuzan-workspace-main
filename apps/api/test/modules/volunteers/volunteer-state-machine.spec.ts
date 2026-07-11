import { describe, expect, it } from "vitest";
import {
  VolunteerStatus,
  canTransition,
  isQualified,
  VALID_TRANSITIONS,
} from "../../../src/modules/volunteers/domain/volunteer.types.js";

describe("Volunteer state machine", () => {
  describe("canTransition", () => {
    it("allows APPLIED → SCREENING", () => {
      expect(canTransition(VolunteerStatus.APPLIED, VolunteerStatus.SCREENING)).toBe(true);
    });

    it("allows SCREENING → ACCEPTED", () => {
      expect(canTransition(VolunteerStatus.SCREENING, VolunteerStatus.ACCEPTED)).toBe(true);
    });

    it("allows SCREENING → SUSPENDED", () => {
      expect(canTransition(VolunteerStatus.SCREENING, VolunteerStatus.SUSPENDED)).toBe(true);
    });

    it("allows ACCEPTED → TRAINING_REQUIRED", () => {
      expect(canTransition(VolunteerStatus.ACCEPTED, VolunteerStatus.TRAINING_REQUIRED)).toBe(true);
    });

    it("allows TRAINING_REQUIRED → TRAINING_IN_PROGRESS", () => {
      expect(canTransition(VolunteerStatus.TRAINING_REQUIRED, VolunteerStatus.TRAINING_IN_PROGRESS)).toBe(true);
    });

    it("allows TRAINING_IN_PROGRESS → EXAM_READY", () => {
      expect(canTransition(VolunteerStatus.TRAINING_IN_PROGRESS, VolunteerStatus.EXAM_READY)).toBe(true);
    });

    it("allows EXAM_READY → QUALIFIED", () => {
      expect(canTransition(VolunteerStatus.EXAM_READY, VolunteerStatus.QUALIFIED)).toBe(true);
    });

    it("allows EXAM_READY → TRAINING_REQUIRED (retrain)", () => {
      expect(canTransition(VolunteerStatus.EXAM_READY, VolunteerStatus.TRAINING_REQUIRED)).toBe(true);
    });

    it("allows QUALIFIED → ACTIVE", () => {
      expect(canTransition(VolunteerStatus.QUALIFIED, VolunteerStatus.ACTIVE)).toBe(true);
    });

    it("allows QUALIFIED → SUSPENDED", () => {
      expect(canTransition(VolunteerStatus.QUALIFIED, VolunteerStatus.SUSPENDED)).toBe(true);
    });

    it("allows ACTIVE → SUSPENDED", () => {
      expect(canTransition(VolunteerStatus.ACTIVE, VolunteerStatus.SUSPENDED)).toBe(true);
    });

    it("allows ACTIVE → LEFT", () => {
      expect(canTransition(VolunteerStatus.ACTIVE, VolunteerStatus.LEFT)).toBe(true);
    });

    it("allows SUSPENDED → ACTIVE (reinstatement)", () => {
      expect(canTransition(VolunteerStatus.SUSPENDED, VolunteerStatus.ACTIVE)).toBe(true);
    });

    it("allows SUSPENDED → LEFT", () => {
      expect(canTransition(VolunteerStatus.SUSPENDED, VolunteerStatus.LEFT)).toBe(true);
    });

    it("denies APPLIED → ACTIVE (skip steps)", () => {
      expect(canTransition(VolunteerStatus.APPLIED, VolunteerStatus.ACTIVE)).toBe(false);
    });

    it("denies APPLIED → QUALIFIED (skip training)", () => {
      expect(canTransition(VolunteerStatus.APPLIED, VolunteerStatus.QUALIFIED)).toBe(false);
    });

    it("denies LEFT → any (terminal state)", () => {
      for (const status of Object.values(VolunteerStatus)) {
        if (status === VolunteerStatus.LEFT) continue;
        expect(canTransition(VolunteerStatus.LEFT, status)).toBe(false);
      }
    });

    it("denies self-transitions", () => {
      for (const status of Object.values(VolunteerStatus)) {
        expect(canTransition(status, status)).toBe(false);
      }
    });
  });

  describe("isQualified", () => {
    it("returns true for QUALIFIED", () => {
      expect(isQualified(VolunteerStatus.QUALIFIED)).toBe(true);
    });

    it("returns true for ACTIVE", () => {
      expect(isQualified(VolunteerStatus.ACTIVE)).toBe(true);
    });

    it("returns false for APPLIED", () => {
      expect(isQualified(VolunteerStatus.APPLIED)).toBe(false);
    });

    it("returns false for SCREENING", () => {
      expect(isQualified(VolunteerStatus.SCREENING)).toBe(false);
    });

    it("returns false for SUSPENDED", () => {
      expect(isQualified(VolunteerStatus.SUSPENDED)).toBe(false);
    });

    it("returns false for LEFT", () => {
      expect(isQualified(VolunteerStatus.LEFT)).toBe(false);
    });
  });

  describe("VALID_TRANSITIONS completeness", () => {
    it("has transitions defined for every status", () => {
      for (const status of Object.values(VolunteerStatus)) {
        expect(VALID_TRANSITIONS[status]).toBeDefined();
        expect(Array.isArray(VALID_TRANSITIONS[status])).toBe(true);
      }
    });
  });
});
