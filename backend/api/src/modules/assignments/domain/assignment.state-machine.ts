import type { AssignmentStatus } from "./assignment.types.js";
import { AssignmentStatusException } from "./assignment.errors.js";

const VALID_TRANSITIONS: Record<AssignmentStatus, AssignmentStatus[]> = {
  DRAFT: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["OPEN", "CANCELLED"],
  OPEN: ["CLOSED", "CANCELLED"],
  CLOSED: ["ARCHIVED"],
  CANCELLED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function canTransition(
  from: AssignmentStatus,
  to: AssignmentStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateTransition(
  from: AssignmentStatus,
  to: AssignmentStatus,
): void {
  if (!canTransition(from, to)) {
    throw new AssignmentStatusException(`不能从 ${from} 转换到 ${to}`);
  }
}

export function isOpen(status: AssignmentStatus): boolean {
  return status === "OPEN";
}

export function isClosed(status: AssignmentStatus): boolean {
  return ["CLOSED", "CANCELLED", "ARCHIVED"].includes(status);
}
