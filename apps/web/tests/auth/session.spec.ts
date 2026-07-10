import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { toWebSession } from "../../app/features/auth/utils/session";

function user(
  memberships: Array<{
    schoolId: string;
    schoolName: string;
    role: "STUDENT" | "TEACHER";
  }>,
) {
  return {
    id: "user-1",
    displayName: "User",
    preferredLocale: "zh-CN",
    memberships,
  };
}

describe("school session", () => {
  it("enters the only school automatically", () => {
    expect(
      toWebSession(user([{ schoolId: "a", schoolName: "A", role: "STUDENT" }]))
        .activeSchoolId,
    ).toBe("a");
  });

  it("requires explicit selection for multiple schools", () => {
    const result = toWebSession(
      user([
        { schoolId: "a", schoolName: "A", role: "TEACHER" },
        { schoolId: "b", schoolName: "B", role: "TEACHER" },
      ]),
    );
    expect(result.activeSchoolId).toBeUndefined();
    expect(result.memberships).toHaveLength(2);
  });

  it("keeps the no-school state explicit", () => {
    expect(toWebSession(user([])).memberships).toEqual([]);
  });

  it("contains no token fields suitable for localStorage", () => {
    expect(JSON.stringify(toWebSession(user([])))).not.toMatch(
      /accessToken|refreshToken/,
    );
  });

  it("does not persist tokens or log credentials", () => {
    const sources = [
      "app/lib/api/client.ts",
      "app/composables/useAuthSession.ts",
      "app/pages/login.vue",
    ]
      .map((path) =>
        readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"),
      )
      .join("\n");
    expect(sources).not.toMatch(/localStorage\.(?:setItem|getItem)/);
    expect(sources).not.toMatch(/console\.(?:log|info|debug|warn|error)/);
  });
});
