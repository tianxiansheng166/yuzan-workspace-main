import { AsyncLocalStorage } from "node:async_hooks";

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
  const next: ObservabilityContext = {
    ...current,
    ...context,
    requestId: context.requestId ?? current.requestId,
    service: context.service ?? current.service,
    environment: context.environment ?? current.environment,
  };
  return storage.run(next, fn);
}

export function getContext(): Readonly<ObservabilityContext> {
  return storage.getStore() ?? defaultContext;
}

export function setContextDefaults(
  defaults: Partial<ObservabilityContext>,
): void {
  Object.assign(defaultContext, defaults);
}
