import type { OperationsStatus } from "../domain/operations.types.js";

export function toOperationsStatusResponse(status: OperationsStatus) {
  return {
    status: status.status,
    timestamp: status.timestamp.toISOString(),
    version: status.version,
    database: status.database,
    activeSchools: status.activeSchools,
  };
}
