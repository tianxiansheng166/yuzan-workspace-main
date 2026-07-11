export type DirtyScope = "GLOBAL" | "SCHOOL" | "ROUTE" | "RESOURCE";

export type DirtyStatus =
  | "CLEAN"
  | "DIRTY"
  | "SAVING"
  | "SAVED_LOCAL"
  | "WAITING_SYNC"
  | "SAVE_FAILED"
  | "CONFLICT"
  | "DISCARDING";

export interface DirtyStateEntrySaveResult {
  status: "success" | "failed" | "conflict" | "unauthorized";
  message?: string;
}

export interface DirtyStateEntry<T = unknown> {
  id: string;
  scope: DirtyScope;
  owner: string;
  title: string;
  description?: string;
  status: DirtyStatus;
  updatedAt: number;
  canAutoSave: boolean;
  canDiscard: boolean;
  isBlocking: boolean;
  save: () => Promise<DirtyStateEntrySaveResult>;
  discard: () => Promise<void>;
  validateBeforeLeave?: () => Promise<boolean | string>;
  metadata?: T;
}

export type DirtyEntryInput<T = unknown> = Omit<
  DirtyStateEntry<T>,
  "updatedAt"
> & {
  updatedAt?: number;
};

export interface DirtyRegistrySnapshot {
  entries: DirtyStateEntry[];
  isProcessingLeave: boolean;
  pendingLeaveTarget: string | null;
}

export type LeaveReason =
  | { kind: "route"; to: string }
  | { kind: "school-switch" }
  | { kind: "logout" }
  | { kind: "beforeunload" };

export type LeaveDecision = "save-and-leave" | "discard-and-leave" | "stay";

export interface DirtyLeaveRequest {
  reason: LeaveReason;
  blockingEntries: DirtyStateEntry[];
  resolve: (decision: LeaveDecision) => void;
}
