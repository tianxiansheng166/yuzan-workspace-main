import type {
  ApiEnvelope,
  ApiErrorBody,
  AuthSessionResponse,
  CourseVersionDetail,
  CourseVersionSummary,
  CurrentUserResponse,
} from "./types";

export type ApiTransport = <T>(path: string, init: RequestInit) => Promise<{ status: number; data?: T }>;

export interface FetchTransportOptions {
  forwardedCookie?: string;
  getAccessToken?: () => string | undefined;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiUnavailableError extends Error {
  constructor(message = "服务暂不可用，请稍后重试。") {
    super(message);
    this.name = "ApiUnavailableError";
  }
}

export function createFetchTransport(
  apiBase: string,
  options: FetchTransportOptions | string = {},
): ApiTransport {
  const normalizedOptions = typeof options === "string"
    ? { forwardedCookie: options }
    : options;

  return async <T>(path: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    if (init.body) headers.set("content-type", "application/json");
    if (normalizedOptions.forwardedCookie) {
      headers.set("cookie", normalizedOptions.forwardedCookie);
    }
    const token = normalizedOptions.getAccessToken?.();
    if (token && !headers.has("authorization")) {
      headers.set("authorization", "Bearer " + token);
    }
    try {
      const response = await fetch(
        `${apiBase.replace(/\/$/, "")}/${path.replace(/^\//, "")}`,
        { ...init, headers, credentials: "include" },
      );
      const data = response.status === 204
        ? undefined
        : await response.json().catch(() => undefined) as T | undefined;
      return { status: response.status, data };
    } catch {
      throw new ApiUnavailableError();
    }
  };
}

export function createProductApiClient(transport: ApiTransport) {
  let refreshFlight: Promise<AuthSessionResponse> | undefined;
  let accessToken: string | undefined;

  function rememberSession(session: AuthSessionResponse) {
    accessToken = session.data.accessToken;
    return session;
  }

  async function unwrap<T>(response: { status: number; data?: T }): Promise<T> {
    if (response.status >= 200 && response.status < 300 && response.data !== undefined) return response.data;
    const body = response.data as ApiErrorBody | undefined;
    throw new ApiError(
      response.status,
      body?.error?.message ?? `请求失败（${response.status}）`,
      body?.error?.code,
      body?.error?.requestId ?? body?.meta?.requestId,
    );
  }

  async function refresh() {
    if (!refreshFlight) {
      refreshFlight = unwrap<AuthSessionResponse>(
        await transport("/auth/refresh", { method: "POST" }),
      ).then(rememberSession).finally(() => { refreshFlight = undefined; });
    }
    return refreshFlight;
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response = await transport<T>(path, init);
    if (response.status === 401 && !path.startsWith("/auth/")) {
      try {
        await refresh();
      } catch (error) {
        accessToken = undefined;
        throw error;
      }
      response = await transport<T>(path, init);
    }
    return unwrap(response);
  }

  return {
    getAccessToken: () => accessToken,
    clearSession: () => { accessToken = undefined; },
    request,
    login: (identifier: string, password: string) =>
      request<AuthSessionResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      }).then(rememberSession),
    refresh,
    currentUser: () => request<CurrentUserResponse>("/me"),
    selectSchool: (schoolId: string) =>
      request<AuthSessionResponse>("/auth/select-school", {
        method: "POST",
        body: JSON.stringify({ schoolId }),
      }).then(rememberSession),
    async logout() {
      try {
        const response = await transport("/auth/logout", { method: "POST" });
        if (response.status !== 204 && response.status !== 401) await unwrap(response);
      } finally {
        accessToken = undefined;
      }
    },
    listCourseDrafts: (schoolId: string) =>
      request<ApiEnvelope<CourseVersionSummary[]>>(`/schools/${schoolId}/course-versions?status=DRAFT`),
    getCourseDraft: (schoolId: string, versionId: string) =>
      request<ApiEnvelope<CourseVersionDetail>>(`/schools/${schoolId}/course-versions/${versionId}`),
    createCourseDraft: (schoolId: string, input: { title: string; description?: string; gradeBand?: string; locale?: string }) =>
      request<ApiEnvelope<CourseVersionSummary>>(`/schools/${schoolId}/course-versions`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateCourseDraft: (
      schoolId: string,
      versionId: string,
      input: { expectedUpdatedAt: string; title?: string; description?: string; gradeBand?: string; locale?: string; objectives?: unknown[]; units?: unknown[] },
    ) => request<ApiEnvelope<CourseVersionDetail>>(`/schools/${schoolId}/course-versions/${versionId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  };
}
