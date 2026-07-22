import type { AssessmentSessionStatus } from "./assessment.types.js";

type TransitionMap = Record<AssessmentSessionStatus, readonly AssessmentSessionStatus[]>;

const ALLOWED_TRANSITIONS: TransitionMap = {
  CREATED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: AssessmentSessionStatus, to: AssessmentSessionStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
