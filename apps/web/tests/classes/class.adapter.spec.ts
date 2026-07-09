import { describe, expect, it } from "vitest";
import type {
  ClassSummary,
  StudentSummary,
} from "../../app/features/classes/types";
import {
  adaptAssessments,
  adaptClassList,
  adaptStudents,
} from "../../app/features/classes/adapters/class.adapter";

describe("class adapter", () => {
  it("adapts class list into view models", () => {
    const input: ClassSummary[] = [
      {
        id: "cls-1",
        name: "三年级一班",
        grade: "三年级",
        studentCount: 24,
        courseCount: 3,
        assessmentCount: 2,
        syncStatus: "synced",
      },
    ];
    const result = adaptClassList(input);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "cls-1",
      name: "三年级一班",
      grade: "三年级",
      meta: "24 名学生 · 3 门课程 · 2 个测评",
      syncLabel: "已同步",
      syncTone: "success",
    });
  });

  it("maps pending sync status to warning tone", () => {
    const result = adaptClassList([
      {
        id: "cls-2",
        name: "三年级二班",
        grade: "三年级",
        studentCount: 0,
        courseCount: 0,
        assessmentCount: 0,
        syncStatus: "pending",
      },
    ]);
    expect(result[0].syncLabel).toBe("同步中");
    expect(result[0].syncTone).toBe("warning");
  });

  it("adapts student assessment and report statuses", () => {
    const input: StudentSummary[] = [
      {
        id: "stu-1",
        displayName: "示例学生甲（demo）",
        isDemo: true,
        assessmentStatus: "submitted",
        retestStatus: "pending",
        reportStatus: "generating",
      },
      {
        id: "stu-2",
        displayName: "示例学生乙（demo）",
        isDemo: true,
        assessmentStatus: "unavailable",
        retestStatus: "unavailable",
        reportStatus: "unavailable",
      },
    ];
    const result = adaptStudents(input);
    expect(result[0].assessmentLabel).toBe("已提交");
    expect(result[0].retestLabel).toBe("待处理");
    expect(result[0].reportLabel).toBe("生成中");
    expect(result[0].isDemo).toBe(true);
    expect(result[1].assessmentLabel).toBe("不可用");
    expect(result[1].reportLabel).toBe("不可用");
  });

  it("adapts assessment entries with type labels", () => {
    const result = adaptAssessments([
      {
        id: "asm-1",
        title: "第三单元形成性测评",
        type: "formative",
        status: "open",
        dueDate: "2026-07-15",
      },
      {
        id: "asm-2",
        title: "期末总结性测评",
        type: "summative",
        status: "draft",
      },
    ]);
    expect(result[0].typeLabel).toBe("形成性测评");
    expect(result[0].statusLabel).toBe("进行中");
    expect(result[0].dueLabel).toBe("截止 2026-07-15");
    expect(result[1].typeLabel).toBe("总结性测评");
    expect(result[1].statusLabel).toBe("草稿");
    expect(result[1].dueLabel).toBe("无截止日期");
  });
});
