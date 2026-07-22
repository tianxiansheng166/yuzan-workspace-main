export enum VolunteerStatus {
  APPLIED = "APPLIED",
  SCREENING = "SCREENING",
  ACCEPTED = "ACCEPTED",
  TRAINING_REQUIRED = "TRAINING_REQUIRED",
  TRAINING_IN_PROGRESS = "TRAINING_IN_PROGRESS",
  EXAM_READY = "EXAM_READY",
  QUALIFIED = "QUALIFIED",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  LEFT = "LEFT",
}

export const VOLUNTEER_STATUSES = Object.values(VolunteerStatus) as readonly VolunteerStatus[];

export const ACTIVE_LIKE_STATUSES: readonly VolunteerStatus[] = [
  VolunteerStatus.QUALIFIED,
  VolunteerStatus.ACTIVE,
];

export const VALID_TRANSITIONS: Readonly<Record<VolunteerStatus, readonly VolunteerStatus[]>> = {
  [VolunteerStatus.APPLIED]: [VolunteerStatus.SCREENING],
  [VolunteerStatus.SCREENING]: [VolunteerStatus.ACCEPTED, VolunteerStatus.SUSPENDED],
  [VolunteerStatus.ACCEPTED]: [VolunteerStatus.TRAINING_REQUIRED],
  [VolunteerStatus.TRAINING_REQUIRED]: [VolunteerStatus.TRAINING_IN_PROGRESS],
  [VolunteerStatus.TRAINING_IN_PROGRESS]: [VolunteerStatus.EXAM_READY],
  [VolunteerStatus.EXAM_READY]: [VolunteerStatus.QUALIFIED, VolunteerStatus.TRAINING_REQUIRED],
  [VolunteerStatus.QUALIFIED]: [VolunteerStatus.ACTIVE, VolunteerStatus.SUSPENDED],
  [VolunteerStatus.ACTIVE]: [VolunteerStatus.SUSPENDED, VolunteerStatus.LEFT],
  [VolunteerStatus.SUSPENDED]: [VolunteerStatus.ACTIVE, VolunteerStatus.LEFT],
  [VolunteerStatus.LEFT]: [],
};

export function canTransition(from: VolunteerStatus, to: VolunteerStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isQualified(status: VolunteerStatus): boolean {
  return ACTIVE_LIKE_STATUSES.includes(status);
}

export enum ServiceType {
  TUTORING = "TUTORING",
  MENTORING = "MENTORING",
  COUNSELING = "COUNSELING",
  CULTURAL_SUPPORT = "CULTURAL_SUPPORT",
  GENERAL = "GENERAL",
}

export interface Volunteer {
  readonly id: string;
  readonly schoolId: string;
  readonly userId: string;
  readonly status: VolunteerStatus;
  readonly displayName: string;
  readonly phone: string;
  readonly email?: string;
  readonly experience?: string;
  readonly qualifications: readonly string[];
  readonly appliedAt: Date;
  readonly qualifiedAt?: Date;
  readonly suspendedReason?: string;
  readonly revision: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface VolunteerSummary {
  readonly id: string;
  readonly schoolId: string;
  readonly userId: string;
  readonly displayName: string;
  readonly status: VolunteerStatus;
  readonly appliedAt: Date;
}

export interface VolunteerServiceTask {
  readonly id: string;
  readonly schoolId: string;
  readonly title: string;
  readonly serviceType: ServiceType;
  readonly classId?: string;
  readonly studentScope: string;
  readonly supervisorTeacherId: string;
  readonly requiredQualification: string;
  readonly assignedVolunteerId?: string;
  readonly status: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface IncidentReport {
  readonly id: string;
  readonly schoolId: string;
  readonly type: string;
  readonly severity: string;
  readonly description: string;
  readonly immediateAction?: string;
  readonly studentRef?: string;
  readonly assignedReviewerId?: string;
  readonly status: string;
  readonly resolution?: string;
  readonly reportedBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
