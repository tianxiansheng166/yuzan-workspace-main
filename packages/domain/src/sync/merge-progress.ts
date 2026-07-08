export interface ProgressSnapshot {
  position: number;
  completed: boolean;
  revision: number;
  updatedAt: string;
}

/**
 * Progress position is monotonic for the same activity. Completion is never
 * inferred from position and can only move false -> true.
 */
export function mergeProgress(
  server: ProgressSnapshot,
  incoming: ProgressSnapshot,
): ProgressSnapshot {
  return {
    position: Math.max(server.position, incoming.position),
    completed: server.completed || incoming.completed,
    revision: Math.max(server.revision, incoming.revision) + 1,
    updatedAt:
      Date.parse(incoming.updatedAt) > Date.parse(server.updatedAt)
        ? incoming.updatedAt
        : server.updatedAt,
  };
}
