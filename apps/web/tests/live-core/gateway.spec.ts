import { describe, expect, it, vi } from "vitest";
import { ApiError, ApiUnavailableError } from "../../app/lib/api/client";
import { ActiveSchoolRequiredError, createLiveCoreGateway, describeLiveFailure, type ProductApiPort } from "../../app/features/live-core/gateway";

function createApi(responses: Record<string, unknown> = {}) {
  const request = vi.fn(async (path: string) => {
    if (!(path in responses)) throw new Error(`Unexpected path ${path}`);
    return responses[path];
  });
  const currentUser = vi.fn(async () => ({
    data: {
      id: "user-1",
      displayName: "Test Teacher",
      preferredLocale: "zh-CN",
      activeSchoolId: "school-1",
      memberships: [{ schoolId: "school-1", schoolName: "Test School", role: "TEACHER" as const, status: "ACTIVE" as const }],
    },
    meta: { requestId: "me-1" },
  }));
  return { api: { currentUser, request } as ProductApiPort, currentUser, request };
}

describe("live core gateway", () => {
  it("scopes every teacher read to the active school", async () => {
    const { api, request } = createApi({
      "/schools/school-1/course-versions": { data: [], meta: { requestId: "1" } },
      "/schools/school-1/classes?limit=50": { data: { items: [], nextCursor: null, hasMore: false }, meta: { requestId: "2" } },
      "/schools/school-1/assignments?limit=50": { data: { items: [], nextCursor: null, hasMore: false }, meta: { requestId: "3" } },
      "/schools/school-1/reports?limit=20": { data: { items: [], nextCursor: null, hasMore: false }, meta: { requestId: "4" } },
    });
    const result = await createLiveCoreGateway(api).teacherOverview();
    expect(result.context.schoolId).toBe("school-1");
    expect(request.mock.calls.map(([path]) => path)).toEqual([
      "/schools/school-1/course-versions",
      "/schools/school-1/classes?limit=50",
      "/schools/school-1/assignments?limit=50",
      "/schools/school-1/reports?limit=20",
    ]);
  });

  it("fails closed when no active school membership exists", async () => {
    const { api } = createApi();
    api.currentUser = vi.fn(async () => ({ data: { id: "user-1", displayName: "User", preferredLocale: "zh-CN", memberships: [] }, meta: { requestId: "me-2" } }));
    await expect(createLiveCoreGateway(api).listCourses()).rejects.toBeInstanceOf(ActiveSchoolRequiredError);
  });

  it("uses PUT and the server revision for real progress", async () => {
    const { api, request } = createApi({
      "/schools/school-1/learning/activities/activity-1/progress": { data: { id: "p-1", activityId: "activity-1", enrollmentId: "enrollment-1", position: 2, completed: true, revision: 4, updatedAt: "2026-07-13T00:00:00.000Z" }, meta: { requestId: "p" } },
    });
    await createLiveCoreGateway(api).updateProgress("activity-1", { enrollmentId: "enrollment-1", position: 2, completed: true, expectedRevision: 3 });
    expect(request).toHaveBeenCalledWith(
      "/schools/school-1/learning/activities/activity-1/progress",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ enrollmentId: "enrollment-1", position: 2, completed: true, expectedRevision: 3 }) }),
    );
  });

  it("waits for create then submits with idempotency and revision", async () => {
    const created = { id: "submission-1", schoolId: "school-1", assignmentId: "assignment-1", enrollmentId: "enrollment-1", attemptNo: 1, status: "DRAFT", revision: 1, createdAt: "2026-07-13T00:00:00.000Z" };
    const { api, request } = createApi({
      "/schools/school-1/submissions": { data: created, meta: { requestId: "create" } },
      "/schools/school-1/submissions/submission-1/submit": { data: { ...created, status: "SUBMITTED", revision: 2 }, meta: { requestId: "submit" } },
    });
    const result = await createLiveCoreGateway(api).createAndSubmit("assignment-1", "enrollment-1", "idem-1");
    expect(result.status).toBe("SUBMITTED");
    expect(request.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ method: "POST", headers: { "idempotency-key": "idem-1" } }));
    expect(request.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ body: JSON.stringify({ expectedRevision: 1 }) }));
  });

  it("maps 401, 403, 503 and network failures without fake success", () => {
    expect(describeLiveFailure(new ApiError(401, "x")).kind).toBe("unauthenticated");
    expect(describeLiveFailure(new ApiError(403, "x")).kind).toBe("permission");
    expect(describeLiveFailure(new ApiError(503, "gap", "PERSISTENCE_PENDING"))).toEqual(expect.objectContaining({ kind: "unavailable", code: "PERSISTENCE_PENDING" }));
    expect(describeLiveFailure(new ApiUnavailableError()).kind).toBe("unavailable");
  });
});