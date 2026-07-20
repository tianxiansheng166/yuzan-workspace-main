import { describe, expect, it } from "vitest";
import type {
  AssignmentSummary,
  AssignmentDetail,
  StudentProgress,
} from "../../app/features/assignment-builder/types";
import {
  adaptAssignmentList,
  adaptAssignmentDetail,
  adaptStudentProgress,
  getAssignmentTypeLabel,
} from "../../app/features/assignment-builder/adapters/assignment.adapter";

describe("assignment adapter", () => {
  it("adapts assignment list with status labels and demo markers", () => {
    const input: AssignmentSummary[] = [
      {
        id: "asn-1",
        classId: "cls-1",
        className: "三年级一班",
        type: "first-assessment",
        title: "单元测评",
        status: "active",
        startsAt: "2026-07-01T08:00",
        dueAt: "2026-07-15T23:59",
        completionRatio: 0.6,
        isDemo: true,
      },
    ];
    const result = adaptAssignmentList(input);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "asn-1",
      className: "三年级一班",
      typeLabel: "首次测评",
      title: "单元测评",
      statusLabel: "进行中",
      statusTone: "warning",
      completionText: "60% 完成",
      isDemo: true,
    });
  });

  it("maps all assignment types to labels", () => {
    expect(getAssignmentTypeLabel("learning")).toBe("学习任务");
    expect(getAssignmentTypeLabel("first-assessment")).toBe("首次测评");
    expect(getAssignmentTypeLabel("retest")).toBe("复测");
    expect(getAssignmentTypeLabel("speech-practice")).toBe("朗读练习");
    expect(getAssignmentTypeLabel("written-practice")).toBe("书面练习");
    expect(getAssignmentTypeLabel("composite")).toBe("综合任务");
  });

  it("adapts detail configuration flags", () => {
    const input: AssignmentDetail = {
      id: "asn-1",
      classId: "cls-1",
      className: "三年级一班",
      type: "composite",
      title: "综合",
      description: "描述",
      status: "scheduled",
      startsAt: "2026-07-01T08:00",
      dueAt: "2026-07-15T23:59",
      allowRetest: true,
      includeSpeech: true,
      includeWritten: true,
      recommendNextCourse: true,
      selectedContents: [],
      students: [],
      isDemo: true,
    };
    const result = adaptAssignmentDetail(input);
    expect(result.configuration).toContain("允许复测");
    expect(result.configuration).toContain("包含朗读");
    expect(result.configuration).toContain("包含书面练习");
    expect(result.configuration).toContain("完成后推荐课程");
    expect(result.statusLabel).toBe("已计划");
  });

  it("adapts student progress statuses", () => {
    const input: StudentProgress[] = [
      {
        studentId: "s1",
        displayName: "甲（demo）",
        isDemo: true,
        progressStatus: "completed",
        speechStatus: "completed",
        writtenStatus: "pending",
        reportStatus: "unavailable",
      },
      {
        studentId: "s2",
        displayName: "乙（demo）",
        isDemo: true,
        progressStatus: "overdue",
        speechStatus: "unavailable",
        writtenStatus: "unavailable",
        reportStatus: "unavailable",
      },
    ];
    const result = adaptStudentProgress(input);
    expect(result[0].progressLabel).toBe("已完成");
    expect(result[0].speechLabel).toBe("已完成");
    expect(result[0].writtenLabel).toBe("待完成");
    expect(result[0].reportLabel).toBe("不可用");
    expect(result[1].progressLabel).toBe("已逾期");
  });
});
