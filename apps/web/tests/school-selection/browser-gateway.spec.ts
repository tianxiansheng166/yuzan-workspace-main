import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBrowserSchoolSelectionGateway } from "../../app/features/school-selection/browser-gateway";

const membership = { schoolId: "school-b", schoolName: "第二学校", role: "TEACHER", membershipStatus: "active" };
const me = (activeSchoolId: string | null) => ({ data: { id: "u1", displayName: "教师", activeSchoolId, memberships: [membership] } });
describe("active school binding", () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  it("posts selection, verifies /me, then commits context", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(me(null)).mockResolvedValueOnce({ data: { accessToken: "token", expiresIn: 60, user: me("school-b").data }, meta: { requestId: "r1" } }).mockResolvedValueOnce(me("school-b"));
    vi.stubGlobal("$fetch", fetch);
    const result = await createBrowserSchoolSelectionGateway("/api").selectSchool("school-b");
    expect(result.status).toBe("selected");
    expect(fetch.mock.calls.map(call => call[0])).toEqual(["/api/me", "/api/auth/select-school", "/api/me"]);
  });
  it("preserves the previous context when verification fails", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(me(null)).mockResolvedValueOnce({ data: { accessToken: "token", expiresIn: 60, user: me("school-b").data }, meta: { requestId: "r1" } }).mockResolvedValueOnce(me("school-a"));
    vi.stubGlobal("$fetch", fetch);
    expect((await createBrowserSchoolSelectionGateway("/api").selectSchool("school-b")).status).toBe("failed");
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
