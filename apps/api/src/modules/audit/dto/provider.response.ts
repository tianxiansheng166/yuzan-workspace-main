import type {
  ProviderHealthStatus,
  ProviderType,
  SystemProvider,
} from "../domain/provider.types.js";

export interface ProviderResponse {
  readonly id: string;
  readonly type: ProviderType;
  readonly enabled: boolean;
  readonly endpointAlias: string | null;
  readonly model: string | null;
  readonly healthStatus: ProviderHealthStatus;
  readonly configured: boolean;
  readonly lastCheckedAt: string | null;
  readonly lastError: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toProviderResponse(provider: SystemProvider): ProviderResponse {
  return {
    id: provider.id,
    type: provider.type,
    enabled: provider.enabled,
    endpointAlias: provider.endpointAlias,
    model: provider.model,
    healthStatus: provider.healthStatus,
    configured: provider.configured,
    lastCheckedAt: provider.lastCheckedAt?.toISOString() ?? null,
    lastError: provider.lastError,
    createdAt: provider.createdAt.toISOString(),
    updatedAt: provider.updatedAt.toISOString(),
  };
}
