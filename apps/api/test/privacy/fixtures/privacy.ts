import { randomUUID } from "node:crypto";
import type {
  RetentionPolicy,
  ConsentVersion,
  DataDeletionRequest,
  DeletionRequestStatus,
} from "../../../src/modules/privacy/domain/privacy.types.js";

export function retentionPolicy(
  overrides: Partial<RetentionPolicy> = {},
): RetentionPolicy {
  const now = new Date();
  return {
    id: randomUUID(),
    resourceType: "USER_DATA",
    retentionDays: 365,
    description: null,
    effectiveFrom: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function consentVersion(
  overrides: Partial<ConsentVersion> = {},
): ConsentVersion {
  const now = new Date();
  return {
    id: randomUUID(),
    purpose: "DATA_COLLECTION",
    version: 1,
    contentHash: randomUUID(),
    contentUrl: null,
    effectiveFrom: now,
    createdAt: now,
    ...overrides,
  };
}

export function deletionRequest(
  overrides: Partial<DataDeletionRequest> = {},
): DataDeletionRequest {
  const now = new Date();
  return {
    id: randomUUID(),
    userId: randomUUID(),
    schoolId: null,
    status: "PENDING" as DeletionRequestStatus,
    requestedAt: now,
    approvedAt: null,
    completedAt: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
