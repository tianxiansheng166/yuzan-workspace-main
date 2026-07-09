import { describe, expect, it } from "vitest";
import {
  getAvailableCategories,
  trainingCategories,
} from "../../app/features/training-hub/data/training-categories";

describe("training categories config", () => {
  it("contains exactly three categories", () => {
    expect(trainingCategories).toHaveLength(3);
  });

  it("covers student courses, teacher training and volunteer training", () => {
    const ids = trainingCategories.map((category) => category.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "student-courses",
        "teacher-training",
        "volunteer-training",
      ]),
    );
  });

  it("keeps titles, audiences and routes clearly separated", () => {
    for (const category of trainingCategories) {
      expect(category.title).toBeTruthy();
      expect(category.audience).toBeTruthy();
      expect(category.route).toMatch(/^\/training\//);
    }
  });

  it("marks the volunteer training route as available", () => {
    const volunteer = trainingCategories.find(
      (category) => category.id === "volunteer-training",
    );
    expect(volunteer).toBeDefined();
    expect(volunteer?.available).toBe(true);
    expect(volunteer?.route).toBe("/training/volunteer");
  });

  it("exposes unavailable categories with a reason", () => {
    const unavailable = trainingCategories.filter(
      (category) => !category.available,
    );
    expect(unavailable.length).toBeGreaterThan(0);

    for (const category of unavailable) {
      expect(category.unavailableReason).toBeTruthy();
    }
  });

  it("returns only available categories", () => {
    const available = getAvailableCategories();
    expect(available.every((category) => category.available)).toBe(true);
    expect(available).toHaveLength(
      trainingCategories.filter((category) => category.available).length,
    );
  });
});
