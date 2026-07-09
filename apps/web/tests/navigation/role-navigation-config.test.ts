import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  roleNavigationGroups,
  roleNavigationStatuses,
  routeAvailability,
} from "../../app/features/role-navigation/role-navigation.config";
import {
  listGroupLabels,
  resolveActiveNavigation,
} from "../../app/features/role-navigation/role-navigation.helpers";

describe("role navigation config", () => {
  it("contains the required student, teacher and platform groups", () => {
    expect(listGroupLabels()).toEqual([
      "学生角色入口",
      "教师角色入口",
      "平台 / 公共入口",
    ]);
  });

  it("includes the required navigation items for each role group", () => {
    const studentLabels =
      roleNavigationGroups[0]?.items.map((item) => item.label) ?? [];
    const teacherLabels =
      roleNavigationGroups[1]?.items.map((item) => item.label) ?? [];
    const platformLabels =
      roleNavigationGroups[2]?.items.map((item) => item.label) ?? [];

    expect(studentLabels).toEqual(["学生今日", "AI 测评", "测评历史"]);
    expect(teacherLabels).toEqual([
      "教师工作台",
      "测评任务",
      "学生报告",
      "教师工具",
    ]);
    expect(platformLabels).toEqual(["培训", "产品方案", "藏语翻译"]);
  });

  it("defines text explanations for demo, pending, unavailable, 待接入 and 外部链接", () => {
    const labels = roleNavigationStatuses.map((status) => status.label);

    expect(labels).toEqual(
      expect.arrayContaining([
        "demo",
        "pending",
        "unavailable",
        "待接入",
        "外部链接",
      ]),
    );

    for (const status of roleNavigationStatuses) {
      expect(status.description.length).toBeGreaterThan(8);
    }
  });

  it("only points to routes that are declared as available and backed by page files", () => {
    const routeMap = new Map(
      routeAvailability.map((entry) => [entry.route, entry.source]),
    );

    for (const group of roleNavigationGroups) {
      for (const item of group.items) {
        expect(routeMap.has(item.to)).toBe(true);

        const source = routeMap.get(item.to);
        expect(source).toBeTruthy();
        expect(
          existsSync(resolve(import.meta.dirname, "../../../../", source!)),
        ).toBe(true);
      }
    }
  });

  it("resolves active routes for student, teacher and platform pages", () => {
    expect(
      resolveActiveNavigation("/assessment/history").currentItem?.label,
    ).toBe("测评历史");
    expect(
      resolveActiveNavigation("/teacher/assessments/new").currentItem?.label,
    ).toBe("测评任务");
    expect(
      resolveActiveNavigation("/training/volunteer").currentItem?.label,
    ).toBe("培训");
  });
});
