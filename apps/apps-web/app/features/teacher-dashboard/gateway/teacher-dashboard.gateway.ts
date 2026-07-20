import {
  ApiError,
  ApiUnavailableError,
  createFetchTransport,
  createProductApiClient,
  type ApiTransport,
} from "../../../lib/api/client";
import type {
  CurrentUserResponse,
  MembershipRole,
} from "../../../lib/api/types";

import type {
  DashboardSource,
  TeacherDashboardAssignment,
  TeacherDashboardClass,
  TeacherDashboardData,
  TeacherDashboardIntegration,
  TeacherDashboardLoadResult,
  TeacherDashboardOperations,
  TeacherDashboardReviewItem,
} from "../types";

interface PagedResponse<T> {
  items: T[];
  nextCursor?: string;
  hasMore?: boolean;
}

export interface TeacherDashboardGatewayOptions {
  apiBase?: string;
  forwardedCookie?: string;
  transport?: ApiTransport;
}

interface RawErrorBody {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
  };
}

const EMPTY_ASSESSMENT: DashboardSource<null> = {
  state: "unavailable",
  data: null,
  code: "ASSESSMENT_PERSISTENCE_PENDING",
  message: "测评持久化仍在建设中，当前入口不会伪造任务或结果。",
};

function activeMembership(
  memberships: CurrentUserResponse["data"]["memberships"],
  schoolId: string,
) {
  return memberships.find((membership) => membership.schoolId === schoolId);
}

function hasTeacherAccess(role: MembershipRole | undefined) {
  return role === "TEACHER" || role === "SCHOOL_ADMIN";
}

function normalizeMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof ApiUnavailableError) {
    return error.message;
  }
  return error instanceof Error ? error.message : "数据暂时无法读取。";
}

function normalizeCode(error: unknown) {
  return error instanceof ApiError ? error.code : undefined;
}

function sourceState(error: unknown): DashboardSource<never>["state"] {
  if (error instanceof ApiError && error.status === 403) return "forbidden";
  if (
    error instanceof ApiUnavailableError ||
    (error instanceof ApiError && [404, 501, 503].includes(error.status))
  ) {
    return "unavailable";
  }
  return "error";
}

async function requestJson<T>(
  transport: ApiTransport,
  path: string,
): Promise<T> {
  const response = await transport<T | RawErrorBody>(path, { method: "GET" });
  if (
    response.status >= 200 &&
    response.status < 300 &&
    response.data !== undefined
  ) {
    return response.data as T;
  }

  const body = response.data as RawErrorBody | undefined;
  throw new ApiError(
    response.status,
    body?.error?.message ?? `请求失败（${response.status}）`,
    body?.error?.code,
    body?.error?.requestId,
  );
}

async function readSource<T>(
  task: () => Promise<T>,
  emptyValue: T,
  emptyWhen: (value: T) => boolean,
): Promise<DashboardSource<T>> {
  try {
    const data = await task();
    return {
      state: emptyWhen(data) ? "empty" : "ready",
      data,
    };
  } catch (error) {
    return {
      state: sourceState(error),
      data: emptyValue,
      message: normalizeMessage(error),
      code: normalizeCode(error),
    };
  }
}

async function loadReviews(
  transport: ApiTransport,
  schoolId: string,
  assignments: DashboardSource<TeacherDashboardAssignment[]>,
): Promise<DashboardSource<TeacherDashboardReviewItem[]>> {
  if (assignments.state !== "ready") {
    return {
      state: assignments.state === "empty" ? "empty" : assignments.state,
      data: [],
      message:
        assignments.state === "empty"
          ? undefined
          : "任务列表不可用，因此无法计算待复核提交。",
      code: assignments.code,
    };
  }

  const reviewableAssignments = assignments.data
    .filter((assignment) => ["OPEN", "CLOSED"].includes(assignment.status))
    .slice(0, 8);

  if (reviewableAssignments.length === 0) {
    return { state: "empty", data: [] };
  }

  const results = await Promise.all(
    reviewableAssignments.map(async (assignment) => {
      try {
        const response = await requestJson<
          PagedResponse<TeacherDashboardReviewItem>
        >(
          transport,
          `/schools/${schoolId}/assignments/${assignment.id}/submissions?limit=100`,
        );
        return response.items.filter(
          (submission) => submission.status === "SUBMITTED",
        );
      } catch (error) {
        return error;
      }
    }),
  );

  const submissions = results.flatMap((result) =>
    Array.isArray(result) ? result : [],
  );
  const errors = results.filter((result) => !Array.isArray(result));

  if (submissions.length > 0) {
    return {
      state: "ready",
      data: submissions,
      ...(errors.length > 0
        ? { message: "部分任务的提交队列暂时无法读取。" }
        : {}),
    };
  }

  if (errors.length > 0) {
    const firstError = errors[0];
    return {
      state: sourceState(firstError),
      data: [],
      message: normalizeMessage(firstError),
      code: normalizeCode(firstError),
    };
  }

  return { state: "empty", data: [] };
}

export function createTeacherDashboardGateway(
  options: TeacherDashboardGatewayOptions,
) {
  const transport =
    options.transport ??
    createFetchTransport(options.apiBase ?? "", options.forwardedCookie);
  const productApi = createProductApiClient(transport);

  return {
    async load(): Promise<TeacherDashboardLoadResult> {
      let currentUser: CurrentUserResponse;
      try {
        currentUser = await productApi.currentUser();
      } catch (error) {
        return {
          kind: "unavailable",
          message: normalizeMessage(error),
          ...(normalizeCode(error) ? { code: normalizeCode(error) } : {}),
        };
      }

      const user = currentUser.data;
      if (!user.activeSchoolId) {
        return { kind: "no-school", user };
      }

      const membership = activeMembership(
        user.memberships,
        user.activeSchoolId,
      );
      if (!hasTeacherAccess(membership?.role)) {
        return {
          kind: "forbidden",
          user,
          ...(membership?.role ? { activeRole: membership.role } : {}),
        };
      }

      const schoolId = user.activeSchoolId;
      const [classes, assignments, integrations, operations] =
        await Promise.all([
          readSource(
            () =>
              requestJson<TeacherDashboardClass[]>(
                transport,
                `/schools/${schoolId}/classes/teachers/me`,
              ),
            [],
            (items) => items.length === 0,
          ),
          readSource(
            async () => {
              const response = await requestJson<
                PagedResponse<TeacherDashboardAssignment>
              >(transport, `/schools/${schoolId}/assignments?limit=100`);
              return response.items;
            },
            [],
            (items) => items.length === 0,
          ),
          readSource(
            () =>
              requestJson<TeacherDashboardIntegration[]>(
                transport,
                `/schools/${schoolId}/tools/integrations`,
              ),
            [],
            (items) => items.length === 0,
          ),
          readSource<TeacherDashboardOperations | null>(
            () =>
              requestJson<TeacherDashboardOperations>(
                transport,
                "/operations/status",
              ),
            null,
            (value) => value === null,
          ),
        ]);

      const reviews = await loadReviews(transport, schoolId, assignments);
      const dashboard: TeacherDashboardData = {
        user,
        schoolId,
        schoolName: membership?.schoolName ?? "当前学校",
        role: membership?.role ?? "TEACHER",
        classes,
        assignments,
        reviews,
        integrations,
        operations,
        assessment: EMPTY_ASSESSMENT,
        loadedAt: new Date().toISOString(),
      };

      return { kind: "ready", dashboard };
    },
  };
}
