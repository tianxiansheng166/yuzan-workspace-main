export type AssignmentWindowState = "SCHEDULED" | "OPEN" | "CLOSED";

export function assignmentWindowState(
  startsAt: Date,
  dueAt: Date,
  now: Date,
): AssignmentWindowState {
  if (now < startsAt) return "SCHEDULED";
  if (now > dueAt) return "CLOSED";
  return "OPEN";
}
