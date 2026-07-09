import { describe, expect, it } from "vitest";

import { createDemoCurriculumStudioGateway } from "../../app/features/curriculum-studio/gateway";

describe("curriculum studio gateway", () => {
  const gateway = createDemoCurriculumStudioGateway();

  it("returns demo dashboard data with all required version states", async () => {
    const result = await gateway.getDashboard("demo");

    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") {
      return;
    }

    expect(result.data.versions.map((item) => item.status)).toEqual(
      expect.arrayContaining(["draft", "review", "published", "unavailable"]),
    );
    expect(result.data.introNote).toContain("CUR-001");
  });

  it("returns permission and unavailable states without faking data", async () => {
    const permission = await gateway.getDashboard("permission");
    const unavailable = await gateway.getDashboard("unavailable");

    expect(permission.kind).toBe("permission");
    expect(unavailable.kind).toBe("unavailable");
  });

  it("returns draft detail and preserves release boundary wording", async () => {
    const result = await gateway.getDraftDetail("plateau-route-v3", "demo");

    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") {
      return;
    }

    expect(result.data.readingAssessments).toHaveLength(2);
    expect(result.data.releaseBoundary).toContain("demo");
    expect(result.data.releaseBoundary).toContain("CUR-001");
  });
});
