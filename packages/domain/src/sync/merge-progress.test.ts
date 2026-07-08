import { describe, expect, it } from "vitest";
import { mergeProgress } from "./merge-progress.js";

describe("mergeProgress", () => {
  it("never moves position or completion backwards", () => {
    expect(
      mergeProgress(
        {
          position: 80,
          completed: true,
          revision: 2,
          updatedAt: "2026-01-01T00:00:00Z",
        },
        {
          position: 20,
          completed: false,
          revision: 2,
          updatedAt: "2026-01-02T00:00:00Z",
        },
      ),
    ).toEqual({
      position: 80,
      completed: true,
      revision: 3,
      updatedAt: "2026-01-02T00:00:00Z",
    });
  });
});
