import { describe, expect, it } from "vitest";

import { createTeacherDashboardGateway } from "../../app/features/teacher-dashboard/gateway/teacher-dashboard.gateway";
import type { ApiTransport } from "../../app/lib/api/client";

interface RouteResponse {
  status: number;
  data?: unknown;
}

function createTransport(
  routes: Record<string, RouteResponse>,
  calls: string[] = [],
): ApiTransport {
  return async <T>(path: string) => {
    calls.push(path);
    const response = routes[path] ?? {
      status: 404,
      data: {
        error: {
          code: "NOT_FOUND",
          message: `No fixture for ${path}`,
        },
      },
    };
    return {
      status: response.status,
      ...(response.data !== undefined ? { data: response.data as T } : {}),
    };
  };
}

const teacherUser = {
  data: {
    id: "user-teacher-01",
    displayName: "测试教师",
    preferredLocale: "zh-CN",
    activeSchoolId: "11111111-1111-4111-8111-111111111111",
    memberships: [
      {
        schoolId: "11111111-1111-4111-8111-111111111111",
        schoolName: "虚构测试学校",
        role: "TEACHER" as const,
      },
    ],
  },
  meta: { requestId: "request-teacher-dashboard" },
};

const schoolId = teacherUser.data.activeSchoolId;

function createReadyRoutes(): Record<string, RouteResponse> {
  return {
    "/me": { status: 200, data: teacherUser },
    [`/schools/${schoolId}/classes/teachers/me`]: {
      status: 200,
      data: [
        {
          id: "class-01",
          name: "七年级一班",
          grade: "七年级",
          studentCount: 28,
        },
      ],
    },
    [`/schools/${schoolId}/assignments?limit=100`]: {
      status: 200,
      data: {
        items: [
          {
            id: "assignment-open",
            title: "朗读练习",
            status: "OPEN",
            startsAt: "2026-07-13T00:00:00.000Z",
            dueAt: "2026-07-14T12:00:00.000Z",
            revision: 2,
          },
          {
            id: "assignment-draft",
            title: "待发布任务",
            status: "DRAFT",
            startsAt: "2026-07-14T00:00:00.000Z",
            dueAt: "2026-07-15T12:00:00.000Z",
            revision: 1,
          },
        ],
        nextCursor: null,
        hasMore: false,
      },
    },
    [`/schools/${schoolId}/assignments/assignment-open/submissions?limit=100`]:
      {
        status: 200,
        data: {
          items: [
            {
              id: "submission-01",
              assignmentId: "assignment-open",
              status: "SUBMITTED",
              submittedAt: "2026-07-13T05:00:00.000Z",
            },
            {
              id: "submission-02",
              assignmentId: "assignment-open",
              status: "DRAFT",
            },
          ],
          nextCursor: null,
          hasMore: false,
        },
      },
    [`/schools/${schoolId}/tools/integrations`]: {
      status: 200,
      data: [
        {
          key: "MINDGRAPH",
          enabled: true,
          status: "OPERATIONAL",
          publicUrl: null,
          lastCheckedAt: "2026-07-13T06:00:00.000Z",
        },
      ],
    },
    "/operations/status": {
      status: 200,
      data: {
        status: "ok",
        timestamp: "2026-07-13T06:00:00.000Z",
        version: "test",
        database: "ok",
        activeSchools: 1,
      },
    },
  };
}

describe("teacher dashboard gateway", () => {
  it("aggregates real sources without inventing assessment results", async () => {
    const calls: string[] = [];
    const gateway = createTeacherDashboardGateway({
      transport: createTransport(createReadyRoutes(), calls),
    });

    const result = await gateway.load();

    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;

    expect(result.dashboard.schoolName).toBe("虚构测试学校");
    expect(result.dashboard.classes).toMatchObject({
      state: "ready",
      data: [{ id: "class-01", studentCount: 28 }],
    });
    expect(result.dashboard.assignments.state).toBe("ready");
    expect(result.dashboard.reviews).toMatchObject({
      state: "ready",
      data: [{ id: "submission-01", status: "SUBMITTED" }],
    });
    expect(result.dashboard.integrations.state).toBe("ready");
    expect(result.dashboard.operations.state).toBe("ready");
    expect(result.dashboard.assessment).toMatchObject({
      state: "unavailable",
      code: "ASSESSMENT_PERSISTENCE_PENDING",
      data: null,
    });
    expect(calls).not.toContain(
      `/schools/${schoolId}/assignments/assignment-draft/submissions?limit=100`,
    );
  });

  it("stops before tenant data requests when the active role is not a teacher", async () => {
    const calls: string[] = [];
    const transport = createTransport(
      {
        "/me": {
          status: 200,
          data: {
            ...teacherUser,
            data: {
              ...teacherUser.data,
              memberships: [
                {
                  ...teacherUser.data.memberships[0],
                  role: "STUDENT",
                },
              ],
            },
          },
        },
      },
      calls,
    );
    const gateway = createTeacherDashboardGateway({ transport });

    const result = await gateway.load();

    expect(result).toMatchObject({ kind: "forbidden", activeRole: "STUDENT" });
    expect(calls).toEqual(["/me"]);
  });

  it("keeps the page available when one source is unavailable", async () => {
    const routes = createReadyRoutes();
    routes[`/schools/${schoolId}/classes/teachers/me`] = {
      status: 503,
      data: {
        error: {
          code: "CLASS_REPOSITORY_UNAVAILABLE",
          message: "班级存储暂不可用",
        },
      },
    };
    const gateway = createTeacherDashboardGateway({
      transport: createTransport(routes),
    });

    const result = await gateway.load();

    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.dashboard.classes).toMatchObject({
      state: "unavailable",
      data: [],
      code: "CLASS_REPOSITORY_UNAVAILABLE",
      message: "班级存储暂不可用",
    });
    expect(result.dashboard.assignments.state).toBe("ready");
    expect(result.dashboard.operations.state).toBe("ready");
  });
});
