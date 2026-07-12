export type ProviderType =
  | "SPEECH"
  | "LLM"
  | "TRANSLATION"
  | "EMBEDDING"
  | "OTHER";

export type ProviderHealthStatus =
  | "UNKNOWN"
  | "HEALTHY"
  | "DEGRADED"
  | "DOWN";

export interface SystemProvider {
  readonly id: string;
  readonly type: ProviderType;
  readonly enabled: boolean;
  readonly endpointAlias: string | null;
  readonly model: string | null;
  readonly healthStatus: ProviderHealthStatus;
  readonly configured: boolean;
  readonly lastCheckedAt: Date | null;
  readonly lastError: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SystemProviderSecret {
  readonly id: string;
  readonly providerId: string;
  readonly secretKey: string;
  readonly createdAt: Date;
}
