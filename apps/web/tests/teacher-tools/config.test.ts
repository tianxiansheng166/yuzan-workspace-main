import { describe, expect, it } from "vitest";
import { teacherToolsConfig } from "../../app/features/teacher-tools/config/teacher-tools.config";

describe("teacher-tools config", () => {
  it("exposes mindMate title, subtitle and description", () => {
    expect(teacherToolsConfig.mindMate.title).toBe("MindMate");
    expect(teacherToolsConfig.mindMate.subtitle).toBeTruthy();
    expect(teacherToolsConfig.mindMate.description).toBeTruthy();
  });

  it("centralizes invite code", () => {
    expect(teacherToolsConfig.mindMate.inviteCode).toBeTruthy();
    expect(typeof teacherToolsConfig.mindMate.inviteCode).toBe("string");
  });

  it("lists web external links with new-window compatible URLs", () => {
    const webLinks = Object.values(
      teacherToolsConfig.mindMate.externalLinks,
    ).filter((link) => link.href.startsWith("http"));

    expect(webLinks.length).toBeGreaterThanOrEqual(1);

    for (const link of webLinks) {
      expect(link.label).toBeTruthy();
      expect(link.href).toMatch(/^https?:\/\//);
    }
  });

  it("provides mindGraph API endpoint and supported types", () => {
    expect(teacherToolsConfig.mindGraph.apiEndpoint).toMatch(/^\/api\//);
    expect(teacherToolsConfig.mindGraph.types.length).toBeGreaterThanOrEqual(1);

    for (const type of teacherToolsConfig.mindGraph.types) {
      expect(type.value).toBeTruthy();
      expect(type.label).toBeTruthy();
      expect(type.description).toBeTruthy();
    }
  });

  it("does not include fabricated thinking-map brand names", () => {
    const labels = teacherToolsConfig.mindGraph.types
      .map((t) => t.label)
      .join(" ");
    const forbidden = [
      "Circle Map",
      "Bubble Map",
      "Tree Map",
      "Brace Map",
      "Flow Map",
    ];

    for (const name of forbidden) {
      expect(labels).not.toContain(name);
    }
  });
});
