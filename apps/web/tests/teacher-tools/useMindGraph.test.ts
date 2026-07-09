import { describe, expect, it, vi } from "vitest";
import {
  useMindGraph,
  type MindGraphResult,
} from "../../app/features/teacher-tools/composables/useMindGraph";

describe("useMindGraph", () => {
  it("starts in idle state", () => {
    const { status, result, errorMessage } = useMindGraph();

    expect(status.value).toBe("idle");
    expect(result.value).toBeNull();
    expect(errorMessage.value).toBe("");
  });

  it("does not transition when prompt is empty or whitespace", async () => {
    const { status, generate } = useMindGraph();

    await generate("   ", "default");

    expect(status.value).toBe("idle");
  });

  it("sets unavailable when the API rejects", async () => {
    const { status, errorMessage, generate } = useMindGraph();

    globalThis.$fetch = vi
      .fn()
      .mockRejectedValue(new Error("service unavailable"));

    await generate("说明方法", "default");

    expect(status.value).toBe("unavailable");
    expect(errorMessage.value).toContain("服务尚未接入");
  });

  it("sets complete when the API returns a valid result", async () => {
    const fake: MindGraphResult = {
      id: "graph-1",
      type: "default",
      title: "测试图",
      nodes: [{ id: "n1", label: "节点" }],
      edges: [],
    };

    globalThis.$fetch = vi.fn().mockResolvedValue(fake);

    const { status, result, generate } = useMindGraph();
    await generate("测试", "default");

    expect(status.value).toBe("complete");
    expect(result.value).toEqual(fake);
  });

  it("sets unavailable for malformed responses", async () => {
    globalThis.$fetch = vi.fn().mockResolvedValue({ unexpected: true });

    const { status, generate } = useMindGraph();
    await generate("测试", "default");

    expect(status.value).toBe("unavailable");
  });

  it("can be reset to idle", () => {
    const { status, result, errorMessage, reset } = useMindGraph();

    status.value = "unavailable";
    result.value = {
      id: "x",
      type: "default",
      title: "x",
      nodes: [],
      edges: [],
    };
    errorMessage.value = "error";

    reset();

    expect(status.value).toBe("idle");
    expect(result.value).toBeNull();
    expect(errorMessage.value).toBe("");
  });
});
