export enum LeadStatus {
  NEW = "NEW",
  CONTACTED = "CONTACTED",
  QUALIFIED = "QUALIFIED",
  NEGOTIATING = "NEGOTIATING",
  CLOSED_WON = "CLOSED_WON",
  CLOSED_LOST = "CLOSED_LOST",
}

export enum ApplicationStatus {
  PENDING = "PENDING",
  UNDER_REVIEW = "UNDER_REVIEW",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  WITHDRAWN = "WITHDRAWN",
}

export enum VolunteerAppStatus {
  PENDING = "PENDING",
  SCREENING = "SCREENING",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
}

export interface CooperationLead {
  readonly id: string;
  readonly organizationName: string;
  readonly contactName: string;
  readonly contactChannel: string;
  readonly region?: string;
  readonly schoolType?: string;
  readonly interestedPlan?: string;
  readonly needs?: string;
  readonly consent: boolean;
  readonly status: LeadStatus;
  readonly assignedOperatorId?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SupportApplication {
  readonly id: string;
  readonly schoolId?: string;
  readonly organizationName?: string;
  readonly guardianName: string;
  readonly guardianContact: string;
  readonly needCategory: string;
  readonly description: string;
  readonly consent: boolean;
  readonly status: ApplicationStatus;
  readonly reviewedBy?: string;
  readonly reviewedAt?: Date;
  readonly reviewNote?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface VolunteerApplication {
  readonly id: string;
  readonly applicantName: string;
  readonly contactInfo: string;
  readonly experience?: string;
  readonly availability?: string;
  readonly motivation?: string;
  readonly consent: boolean;
  readonly status: VolunteerAppStatus;
  readonly reviewedBy?: string;
  readonly reviewedAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
