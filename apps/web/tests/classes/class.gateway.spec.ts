import { describe, expect, it } from "vitest";
import {
  fetchClassDetail,
  fetchClassList,
} from "../../app/features/classes/gateway/class.gateway";

describe("class gateway", () => {
  it("returns a teacher role and demo class list", async () => {
    const result = await fetchClassList();
    expect(result.role).toBe("teacher");
    expect(result.classes.length).toBeGreaterThan(0);
    for (const cls of result.classes) {
      expect(cls.id).toBeTruthy();
      expect(cls.name).toBeTruthy();
      expect(typeof cls.studentCount).toBe("number");
      expect(typeof cls.courseCount).toBe("number");
      expect(typeof cls.assessmentCount).toBe("number");
    }
  });

  it("returns demo students marked as demo", async () => {
    const result = await fetchClassDetail("cls-demo-01");
    expect(result.role).toBe("teacher");
    expect(result.class).not.toBeNull();
    expect(result.class!.students.length).toBeGreaterThan(0);
    for (const student of result.class!.students) {
      expect(student.isDemo).toBe(true);
      expect(student.displayName).toContain("demo");
    }
  });

  it("returns empty class for the empty fixture", async () => {
    const result = await fetchClassDetail("cls-empty");
    expect(result.class).not.toBeNull();
    expect(result.class!.students).toHaveLength(0);
    expect(result.class!.assessments).toHaveLength(0);
  });

  it("throws for the error fixture", async () => {
    await expect(fetchClassDetail("cls-error")).rejects.toThrow(
      "Failed to load class detail",
    );
  });
});
