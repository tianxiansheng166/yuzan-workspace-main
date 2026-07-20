import { describe, expect, it } from "vitest";

import {
  getChecklistMeta,
  getLibraryKindLabel,
  getResourceStateLabel,
  getVersionStatusMeta,
} from "../../app/features/curriculum-studio/studio-copy";

describe("curriculum studio labels", () => {
  it("maps version statuses to explicit labels and tones", () => {
    expect(getVersionStatusMeta("draft")).toMatchObject({
      label: "草稿",
      tone: "neutral",
    });
    expect(getVersionStatusMeta("published")).toMatchObject({
      label: "已发布",
      tone: "success",
    });
  });

  it("keeps resource state labels inside demo/pending/unavailable", () => {
    expect(getResourceStateLabel("demo")).toBe("demo");
    expect(getResourceStateLabel("pending")).toBe("pending");
    expect(getResourceStateLabel("unavailable")).toBe("unavailable");
  });

  it("covers checklist and library labels for the page", () => {
    expect(getChecklistMeta("blocked")).toMatchObject({
      label: "阻塞",
      tone: "danger",
    });
    expect(getLibraryKindLabel("assessment-text")).toBe("朗读测评文本");
  });
});
