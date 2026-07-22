import type {
  CooperationLead,
  LeadStatus,
  SupportApplication,
  ApplicationStatus,
  VolunteerApplication,
  VolunteerAppStatus,
} from "../domain/cooperation.types.js";

// ---------- Public responses (no internal processing details) ----------

export interface PublicLeadResponse {
  readonly id: string;
  readonly organizationName: string;
  readonly createdAt: string;
}

export function toPublicLeadResponse(lead: CooperationLead): PublicLeadResponse {
  return {
    id: lead.id,
    organizationName: lead.organizationName,
    createdAt: lead.createdAt.toISOString(),
  };
}

export interface PublicSupportApplicationResponse {
  readonly id: string;
  readonly needCategory: string;
  readonly createdAt: string;
}

export function toPublicSupportApplicationResponse(
  application: SupportApplication,
): PublicSupportApplicationResponse {
  return {
    id: application.id,
    needCategory: application.needCategory,
    createdAt: application.createdAt.toISOString(),
  };
}

export interface PublicVolunteerApplicationResponse {
  readonly id: string;
  readonly applicantName: string;
  readonly createdAt: string;
}

export function toPublicVolunteerApplicationResponse(
  application: VolunteerApplication,
): PublicVolunteerApplicationResponse {
  return {
    id: application.id,
    applicantName: application.applicantName,
    createdAt: application.createdAt.toISOString(),
  };
}

// ---------- Full responses (authorized staff only) ----------

export interface LeadResponse {
  readonly id: string;
  readonly organizationName: string;
  readonly contactName: string;
  readonly contactChannel: string;
  readonly region: string | undefined;
  readonly schoolType: string | undefined;
  readonly interestedPlan: string | undefined;
  readonly needs: string | undefined;
  readonly status: LeadStatus;
  readonly assignedOperatorId: string | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toLeadResponse(lead: CooperationLead): LeadResponse {
  return {
    id: lead.id,
    organizationName: lead.organizationName,
    contactName: lead.contactName,
    contactChannel: lead.contactChannel,
    region: lead.region,
    schoolType: lead.schoolType,
    interestedPlan: lead.interestedPlan,
    needs: lead.needs,
    status: lead.status,
    assignedOperatorId: lead.assignedOperatorId,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

export interface SupportApplicationResponse {
  readonly id: string;
  readonly schoolId: string | undefined;
  readonly organizationName: string | undefined;
  readonly guardianName: string;
  readonly guardianContact: string;
  readonly needCategory: string;
  readonly description: string;
  readonly status: ApplicationStatus;
  readonly reviewedBy: string | undefined;
  readonly reviewedAt: string | undefined;
  readonly reviewNote: string | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toSupportApplicationResponse(
  application: SupportApplication,
): SupportApplicationResponse {
  return {
    id: application.id,
    schoolId: application.schoolId,
    organizationName: application.organizationName,
    guardianName: application.guardianName,
    guardianContact: application.guardianContact,
    needCategory: application.needCategory,
    description: application.description,
    status: application.status,
    reviewedBy: application.reviewedBy,
    reviewedAt: application.reviewedAt?.toISOString(),
    reviewNote: application.reviewNote,
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  };
}

export interface VolunteerApplicationResponse {
  readonly id: string;
  readonly applicantName: string;
  readonly contactInfo: string;
  readonly experience: string | undefined;
  readonly availability: string | undefined;
  readonly motivation: string | undefined;
  readonly status: VolunteerAppStatus;
  readonly reviewedBy: string | undefined;
  readonly reviewedAt: string | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toVolunteerApplicationResponse(
  application: VolunteerApplication,
): VolunteerApplicationResponse {
  return {
    id: application.id,
    applicantName: application.applicantName,
    contactInfo: application.contactInfo,
    experience: application.experience,
    availability: application.availability,
    motivation: application.motivation,
    status: application.status,
    reviewedBy: application.reviewedBy,
    reviewedAt: application.reviewedAt?.toISOString(),
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  };
}
