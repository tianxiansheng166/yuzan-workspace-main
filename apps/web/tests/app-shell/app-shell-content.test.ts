import { describe, expect, it } from "vitest";

import { getAppShellContext } from "../../app/features/app-shell/app-shell-content";

describe("app shell context", () => {
  it("maps assessment pages to the student role and assessment area", () => {
    const context = getAppShellContext("/assessment/reading");

    expect(context.roleLabel).toBe("学生角色入口");
    expect(context.areaLabel).toBe("AI 测评");
    expect(context.contextSummary).toContain("pending");
  });

  it("maps teacher tools pages to the teacher role", () => {
    const context = getAppShellContext("/teacher-tools/mindgraph");

    expect(context.roleLabel).toBe("教师角色入口");
    expect(context.areaLabel).toBe("教师工具");
    expect(context.contextSummary).toContain("外部链接");
  });

  it("falls back to the public shell context for unknown routes", () => {
    const context = getAppShellContext("/studio");

    expect(context.roleLabel).toBe("公共浏览");
    expect(context.areaLabel).toBe("站点总览");
    expect(context.contextSummary).toContain("未映射");
  });
});
