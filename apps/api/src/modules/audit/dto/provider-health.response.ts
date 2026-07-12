import type {
  ProviderHealthStatus,
  SystemProvider,
} from "../domain/provider.types.js";

export interface ProviderHealthResponse {
  readonly id: string;
  readonly healthStatus: ProviderHealthStatus;
  readonly lastCheckedAt: Date | null;
  readonly lastError: string | null;
}

export function toProviderHealthResponse(
  provider: SystemProvider,
): ProviderHealthResponse {
  return {
    id: provider.id,
    healthStatus: provider.healthStatus,
    lastCheckedAt: provider.lastCheckedAt,
    lastError: provider.lastError,
  };
}
