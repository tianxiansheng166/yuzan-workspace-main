import { randomUUID } from "node:crypto";
import type { SystemProvider, SystemProviderSecret } from "../../../src/modules/audit/domain/provider.types.js";

export function systemProvider(overrides: Partial<SystemProvider> = {}): SystemProvider {
  const now = new Date();
  return {
    id: randomUUID(),
    type: "LLM",
    enabled: true,
    endpointAlias: null,
    model: null,
    healthStatus: "UNKNOWN",
    configured: false,
    lastCheckedAt: null,
    lastError: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function providerSecret(overrides: Partial<SystemProviderSecret> = {}): SystemProviderSecret {
  return {
    id: randomUUID(),
    providerId: "provider-1",
    secretKey: "sk-test-key-12345",
    createdAt: new Date(),
    ...overrides,
  };
}
