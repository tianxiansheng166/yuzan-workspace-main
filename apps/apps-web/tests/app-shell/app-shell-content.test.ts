import { describe, expect, it } from "vitest";
import { getAppShellContext } from "../../app/features/app-shell/app-shell-content";

describe("app shell context", () => {
  it("maps registered routes to their product port", () => {
    expect(getAppShellContext("/assessment/reading")).toMatchObject({
      roleLabel: "STUDENT",
      areaLabel: "朗读测评",
    });
    expect(getAppShellContext("/teacher-tools/mindgraph")).toMatchObject({
      roleLabel: "TEACHER",
      areaLabel: "MindGraph",
    });
  });
  it("reports unregistered routes explicitly", () => {
    expect(getAppShellContext("/not-registered").contextSummary).toContain(
      "未登记",
    );
  });
});
