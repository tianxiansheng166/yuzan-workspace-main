import type { PlayerEvent, PlayerSnapshot } from "../types";

export const playerSteps = [
  "goal",
  "material",
  "tip",
  "practice",
  "check",
  "save",
  "next",
] as const;

export function transitionPlayer(
  snapshot: PlayerSnapshot,
  event: PlayerEvent,
): PlayerSnapshot {
  if (snapshot.busy && ["NEXT", "SAVE_LOCAL", "SUBMIT"].includes(event))
    return snapshot;
  if (snapshot.status === "completed") return snapshot;
  if (event === "PAUSE") return { ...snapshot, status: "paused" };
  if (event === "RESUME") return { ...snapshot, status: "in-progress" };
  if (event === "SAVE_LOCAL")
    return { ...snapshot, status: "local-only", dirty: false };
  if (event === "SUBMIT")
    return { ...snapshot, status: "pending-sync", dirty: false };
  if (event === "REQUEST_REVISION")
    return { ...snapshot, status: "needs-revision" };
  if (event === "BACK")
    return { ...snapshot, stepIndex: Math.max(0, snapshot.stepIndex - 1) };
  if (event === "START" || event === "NEXT") {
    return {
      ...snapshot,
      status: "in-progress",
      dirty: true,
      stepIndex: Math.min(
        playerSteps.length - 1,
        snapshot.stepIndex + (event === "NEXT" ? 1 : 0),
      ),
    };
  }
  return snapshot;
}

export function needsExitConfirmation(snapshot: PlayerSnapshot) {
  return (
    snapshot.dirty ||
    ["in-progress", "local-only", "pending-sync"].includes(snapshot.status)
  );
}
