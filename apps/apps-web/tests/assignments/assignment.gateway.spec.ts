import { describe, expect, it } from "vitest";
import {
  fetchAssignmentDetail,
  fetchAssignmentList,
  publishAssignment,
  saveAssignmentDraft,
} from "../../app/features/assignment-builder/gateway/assignment.gateway";

describe("assignment gateway", () => {
  it("returns teacher role and demo assignments", async () => {
    const result = await fetchAssignmentList();
    expect(result.role).toBe("teacher");
    expect(result.assignments.length).toBeGreaterThan(0);
    for (const a of result.assignments) {
      expect(a.id).toBeTruthy();
      expect(a.title).toBeTruthy();
      expect(a.isDemo).toBe(true);
      expect([
        "draft",
        "scheduled",
        "active",
        "completed",
        "unavailable",
      ]).toContain(a.status);
    }
  });

  it("returns assignment detail for known id", async () => {
    const result = await fetchAssignmentDetail("asn-demo-01");
    expect(result.role).toBe("teacher");
    expect(result.assignment).not.toBeNull();
    expect(result.assignment!.students.length).toBeGreaterThan(0);
    for (const student of result.assignment!.students) {
      expect(student.isDemo).toBe(true);
    }
  });

  it("returns null assignment for unknown id", async () => {
    const result = await fetchAssignmentDetail("asn-unknown");
    expect(result.assignment).toBeNull();
  });

  it("throws for error fixture", async () => {
    await expect(fetchAssignmentDetail("asn-error")).rejects.toThrow(
      "Failed to load assignment detail",
    );
  });

  it("save draft returns demo success", async () => {
    const result = await saveAssignmentDraft({
      classId: "cls-demo-01",
      type: "learning",
      title: "测试草稿",
      description: "",
      selectedContents: [{ id: "c1", kind: "course", title: "课程" }],
      startsAt: "2026-07-01T08:00",
      dueAt: "2026-07-15T23:59",
      allowRetest: false,
      includeSpeech: false,
      includeWritten: false,
      recommendNextCourse: false,
    });
    expect(result.success).toBe(true);
    expect(result.demo).toBe(true);
    expect(result.id).toBeTruthy();
  });

  it("publish returns demo failure", async () => {
    const result = await publishAssignment({
      classId: "cls-demo-01",
      type: "learning",
      title: "测试发布",
      description: "",
      selectedContents: [{ id: "c1", kind: "course", title: "课程" }],
      startsAt: "2026-07-01T08:00",
      dueAt: "2026-07-15T23:59",
      allowRetest: false,
      includeSpeech: false,
      includeWritten: false,
      recommendNextCourse: false,
    });
    expect(result.success).toBe(false);
    expect(result.demo).toBe(true);
    expect(result.message).toContain("ASN-001");
  });
});
