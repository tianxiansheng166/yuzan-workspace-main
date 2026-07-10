import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export interface ObservabilityContext {
  requestId: string;
  correlationId?: string;
  safeTenantRef?: string;
  safeUserRef?: string;
  service: string;
  environment: string;
}

const defaultContext: ObservabilityContext = {
  requestId: "unknown",
  service: "unknown",
  environment: process.env.NODE_ENV ?? "development",
};

const storage = new AsyncLocalStorage<ObservabilityContext>();

export function runWithContext<T>(
  context: Partial<ObservabilityContext>,
  fn: () => T,
): T {
  const current = storage.getStore() ?? defaultContext;
  const correlationId = resolveCorrelationId(context, current);
  const next: ObservabilityContext = {
    ...current,
    ...context,
    requestId: context.requestId ?? current.requestId,
    service: context.service ?? current.service,
    environment: context.environment ?? current.environment,
  };
  if (correlationId === undefined) {
    delete next.correlationId;
  } else {
    next.correlationId = correlationId;
  }
  return storage.run(next, fn);
}

function resolveCorrelationId(
  context: Partial<ObservabilityContext>,
  current: ObservabilityContext,
): string | undefined {
  if (!("correlationId" in context)) return current.correlationId;
  if (isSafeId(context.correlationId)) return context.correlationId;
  if (isSafeId(context.requestId)) return context.requestId;
  if (current.requestId !== "unknown" && isSafeId(current.requestId)) {
    return current.requestId;
  }
  return randomUUID();
}

function isSafeId(value: unknown): value is string {
  return typeof value === "string" && CORRELATION_ID_PATTERN.test(value);
}

export function getContext(): Readonly<ObservabilityContext> {
  return storage.getStore() ?? defaultContext;
}

export function setContextDefaults(
  defaults: Partial<ObservabilityContext>,
): void {
  const safeDefaults = { ...defaults };
  if ("correlationId" in safeDefaults) {
    safeDefaults.correlationId = isSafeId(safeDefaults.correlationId)
      ? safeDefaults.correlationId
      : randomUUID();
  }
  Object.assign(defaultContext, safeDefaults);
}
