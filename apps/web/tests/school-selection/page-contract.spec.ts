import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  resolve(import.meta.dirname, "../../app/pages/select-school.vue"),
  "utf8",
);
const state = readFileSync(
  resolve(import.meta.dirname, "../../app/features/school-selection/state.ts"),
  "utf8",
);
describe("select-school page contract", () => {
  it("uses real HTML controls and exposes all user-facing states", () => {
    for (const status of [
      "LOADING_MEMBERSHIPS",
      "NO_SCHOOL",
      "ONE_SCHOOL",
      "MULTIPLE_SCHOOLS",
      "SELECTING",
      "SELECTION_FAILED",
      "MEMBERSHIP_INACTIVE",
      "SCHOOL_INACTIVE",
      "SESSION_EXPIRED",
      "NETWORK_ERROR",
      "UNKNOWN_ROLE",
    ])
      expect(`${page}\n${state}`).toContain(status);
    expect(page).toContain("<ol");
    expect(page).toContain("<YxButton");
    expect(page).not.toContain("ClientOnly");
  });
  it("includes responsive and reduced-motion handling", () => {
    expect(page).toContain("max-width: 48rem");
    expect(page).toContain("prefers-reduced-motion");
  });
});
