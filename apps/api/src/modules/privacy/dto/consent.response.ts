import type { ConsentVersion } from "../domain/privacy.types.js";

export interface ConsentVersionResponse {
  readonly id: string;
  readonly purpose: string;
  readonly version: number;
  readonly contentHash: string;
  readonly contentUrl: string | null;
  readonly effectiveFrom: string;
  readonly createdAt: string;
}

export function toConsentVersionResponse(
  consent: ConsentVersion,
): ConsentVersionResponse {
  return {
    id: consent.id,
    purpose: consent.purpose,
    version: consent.version,
    contentHash: consent.contentHash,
    contentUrl: consent.contentUrl,
    effectiveFrom: consent.effectiveFrom.toISOString(),
    createdAt: consent.createdAt.toISOString(),
  };
}
