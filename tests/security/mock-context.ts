import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";

export interface MockContextOptions {
  readonly headers?: Record<string, string | string[] | undefined>;
  readonly params?: Record<string, string>;
  readonly query?: Record<string, string>;
  readonly body?: Record<string, unknown>;
  readonly handler?: (...args: unknown[]) => unknown;
  readonly classRef?: new (...args: unknown[]) => unknown;
}

export function createMockExecutionContext(
  options: MockContextOptions,
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

  const handler = options.handler ?? (() => undefined);
  const classRef = options.classRef ?? class TestRef {};

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    getHandler: () => handler,
    getClass: () => classRef,
  } as unknown as ExecutionContext;
}

export function createMockReflector(metadata: Map<symbol, unknown>): Reflector {
  return {
    getAllAndOverride: <T = unknown>(
      token: symbol,
      _targets: unknown[],
    ): T | undefined => {
      return (metadata.get(token) as T) ?? undefined;
    },
  } as unknown as Reflector;
}
