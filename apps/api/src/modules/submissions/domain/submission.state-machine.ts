import type { SubmissionStatus } from "./submission.types.js";

/**
 * Valid state transitions for a Submission.
 *
 * Each key maps to the set of statuses that may follow it.
 */
const VALID_TRANSITIONS: Readonly<Record<SubmissionStatus, readonly SubmissionStatus[]>> = {
  IN_PROGRESS: ["PENDING_SYNC", "SUBMITTED"],
  PENDING_SYNC: ["SUBMITTED"],
  SUBMITTED: ["PROCESSING"],
  PROCESSING: ["NEEDS_REVIEW"],
  NEEDS_REVIEW: ["REVIEWED"],
  REVIEWED: ["RETURNED", "ACCEPTED"],
  RETURNED: ["IN_PROGRESS", "SUBMITTED"],
  ACCEPTED: [],
};

/**
 * Returns true if a transition from `from` to `to` is valid.
 */
export function canTransition(from: SubmissionStatus, to: SubmissionStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Validates a state transition. Throws if the transition is not allowed.
 */
export function validateTransition(from: SubmissionStatus, to: SubmissionStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Invalid submission state transition: ${from} -> ${to}`,
    );
  }
}

/**
 * Returns true if the submission is in an "open" state
 * (student can still modify content).
 */
export function isOpen(status: SubmissionStatus): boolean {
  return status === "IN_PROGRESS" || status === "SUBMITTED";
}

/**
 * Returns true if the submission is in a reviewable state
 * (teacher can review).
 */
export function isReviewable(status: SubmissionStatus): boolean {
  return status === "NEEDS_REVIEW" || status === "REVIEWED";
}
