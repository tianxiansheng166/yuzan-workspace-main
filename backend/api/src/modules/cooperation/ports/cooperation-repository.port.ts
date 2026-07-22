import type {
  CooperationLead,
  LeadStatus,
  SupportApplication,
  ApplicationStatus,
  VolunteerApplication,
  VolunteerAppStatus,
} from "../domain/cooperation.types.js";

export const COOPERATION_REPOSITORY = Symbol("COOPERATION_REPOSITORY");

export interface ListLeadsOptions {
  readonly status?: LeadStatus;
  readonly limit: number;
  readonly cursor?: string;
}

export interface ListSupportApplicationsOptions {
  readonly status?: ApplicationStatus;
  readonly limit: number;
  readonly cursor?: string;
}

export interface ListVolunteerApplicationsOptions {
  readonly status?: VolunteerAppStatus;
  readonly limit: number;
  readonly cursor?: string;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface CooperationRepositoryPort {
  createLead(lead: Omit<CooperationLead, "id" | "status" | "createdAt" | "updatedAt">): Promise<CooperationLead>;
  findLeadById(leadId: string): Promise<CooperationLead | null>;
  listLeads(options: ListLeadsOptions): Promise<PaginatedResult<CooperationLead>>;
  updateLeadStatus(leadId: string, status: LeadStatus, assignedOperatorId?: string): Promise<CooperationLead>;

  createSupportApplication(application: Omit<SupportApplication, "id" | "status" | "createdAt" | "updatedAt">): Promise<SupportApplication>;
  findSupportApplicationById(applicationId: string): Promise<SupportApplication | null>;
  listSupportApplications(options: ListSupportApplicationsOptions): Promise<PaginatedResult<SupportApplication>>;
  updateSupportApplicationStatus(applicationId: string, status: ApplicationStatus, reviewedBy?: string, reviewNote?: string): Promise<SupportApplication>;

  createVolunteerApplication(application: Omit<VolunteerApplication, "id" | "status" | "createdAt" | "updatedAt">): Promise<VolunteerApplication>;
  findVolunteerApplicationById(applicationId: string): Promise<VolunteerApplication | null>;
  listVolunteerApplications(options: ListVolunteerApplicationsOptions): Promise<PaginatedResult<VolunteerApplication>>;
  updateVolunteerApplicationStatus(applicationId: string, status: VolunteerAppStatus, reviewedBy?: string): Promise<VolunteerApplication>;
}
