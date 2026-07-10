import type {
  ApiErrorBody,
  AuthSessionResponse,
  CurrentUserResponse,
} from "./types";

export interface ApiResponse<T> {
  status: number;
  data?: T;
}

export type ApiTransport = <T>(
  path: string,
  init: RequestInit,
) => Promise<ApiResponse<T>>;

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
  constructor(message = "身份服务暂不可用，请稍后重试。") {
    super(message);
    this.name = "ApiUnavailableError";
  }
}

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export function createFetchTransport(
  apiBase: string,
  forwardedCookie?: string,
): ApiTransport {
  return async <T>(path: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    if (init.body) headers.set("content-type", "application/json");
    if (forwardedCookie) headers.set("cookie", forwardedCookie);

    let response: Response;
    try {
      response = await fetch(joinUrl(apiBase, path), {
        ...init,
        headers,
        credentials: "include",
      });
    } catch {
      throw new ApiUnavailableError("无法连接身份服务，请检查网络后重试。");
    }

    const data =
      response.status === 204
        ? undefined
        : ((await response.json().catch(() => undefined)) as T | undefined);
    return { status: response.status, data };
  };
}

export interface AuthApiClient {
  login(identifier: string, password: string): Promise<AuthSessionResponse>;
  currentUser(): Promise<CurrentUserResponse>;
  refresh(): Promise<AuthSessionResponse>;
  logout(): Promise<void>;
  request<T>(path: string, init?: RequestInit): Promise<T>;
}

export function createAuthApiClient(
  transport: ApiTransport,
  onRefreshFailure: () => void = () => undefined,
): AuthApiClient {
  let refreshFlight: Promise<AuthSessionResponse> | undefined;

  async function unwrap<T>(response: ApiResponse<T>): Promise<T> {
    if (response.status >= 200 && response.status < 300 && response.data) {
      return response.data;
    }
    const body = response.data as ApiErrorBody | undefined;
    throw new ApiError(
      response.status,
      body?.error?.message ?? `请求失败（${response.status}）`,
      body?.error?.code,
      body?.error?.requestId,
    );
  }

  async function refresh() {
    if (!refreshFlight) {
      refreshFlight = (async () =>
        unwrap<AuthSessionResponse>(
          await transport("/auth/refresh", { method: "POST" }),
        ))()
        .catch((error) => {
          onRefreshFailure();
          throw error;
        })
        .finally(() => {
          refreshFlight = undefined;
        });
    }
    return refreshFlight;
  }

  async function request<T>(path: string, init: RequestInit = {}) {
    let response = await transport<T>(path, init);
    if (
      response.status === 401 &&
      path !== "/auth/login" &&
      path !== "/auth/refresh"
    ) {
      await refresh();
      response = await transport<T>(path, init);
    }
    return unwrap(response);
  }

  return {
    login: (identifier, password) =>
      request<AuthSessionResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      }),
    currentUser: () => request<CurrentUserResponse>("/me"),
    refresh,
    async logout() {
      const response = await transport("/auth/logout", { method: "POST" });
      if (response.status !== 204 && response.status !== 401) {
        await unwrap(response);
      }
    },
    request,
  };
}
