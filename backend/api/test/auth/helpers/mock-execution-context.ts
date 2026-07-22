import type { ExecutionContext } from "@nestjs/common";

export interface MockContextOptions {
  readonly headers?: Record<string, string | string[] | undefined>;
  readonly params?: Record<string, string>;
  readonly query?: Record<string, string>;
  readonly body?: Record<string, unknown>;
}

export function createMockExecutionContext(
  options: MockContextOptions = {},
): ExecutionContext {
  const request = {
    headers: options.headers ?? {},
    params: options.params ?? {},
    query: options.query ?? {},
    body: options.body ?? {},
    method: "GET",
    path: "/test",
  };

  const response = {
    getHeader: (_name: string): string | undefined => "request-id-1",
    setHeader: (_name: string, _value: string): void => {},
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    getHandler: () => () => undefined,
    getClass: () => class TestRef {},
  } as unknown as ExecutionContext;
}
