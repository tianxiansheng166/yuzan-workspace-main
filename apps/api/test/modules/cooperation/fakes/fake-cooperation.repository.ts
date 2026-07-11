import type {
  CooperationLead,
  SupportApplication,
  VolunteerApplication,
  LeadStatus,
  ApplicationStatus,
  VolunteerAppStatus,
} from "../../../../src/modules/cooperation/domain/cooperation.types.js";
import type {
  CooperationRepositoryPort,
  ListLeadsOptions,
  ListSupportApplicationsOptions,
  ListVolunteerApplicationsOptions,
  PaginatedResult,
} from "../../../../src/modules/cooperation/ports/cooperation-repository.port.js";

export class FakeCooperationRepository implements CooperationRepositoryPort {
  private leads: Map<string, CooperationLead> = new Map();
  private supportApplications: Map<string, SupportApplication> = new Map();
  private volunteerApplications: Map<string, VolunteerApplication> = new Map();
  private nextLeadId = 1;
  private nextAppId = 1;
  private nextVolAppId = 1;

  // ---------- Leads ----------

  async createLead(
    data: Omit<CooperationLead, "id" | "status" | "createdAt" | "updatedAt">,
  ): Promise<CooperationLead> {
    const now = new Date();
    const lead: CooperationLead = {
      id: `lead-${this.nextLeadId++}`,
      ...data,
      status: "NEW" as LeadStatus,
      createdAt: now,
      updatedAt: now,
    };
    this.leads.set(lead.id, lead);
    return lead;
  }

  async findLeadById(leadId: string): Promise<CooperationLead | null> {
    return this.leads.get(leadId) ?? null;
  }

  async listLeads(options: ListLeadsOptions): Promise<PaginatedResult<CooperationLead>> {
    let items = [...this.leads.values()];

    if (options.status) {
      items = items.filter((l) => l.status === options.status);
    }

    const limit = options.limit;
    const start = options.cursor
      ? items.findIndex((i) => i.id === options.cursor) + 1
      : 0;
    const slice = items.slice(start, start + limit);
    const hasMore = start + limit < items.length;

    return {
      items: slice,
      nextCursor: hasMore && slice.length > 0 ? slice[slice.length - 1].id : null,
      hasMore,
    };
  }

  async updateLeadStatus(
    leadId: string,
    status: LeadStatus,
    assignedOperatorId?: string,
  ): Promise<CooperationLead> {
    const existing = this.leads.get(leadId);
    if (!existing) throw new Error(`Lead ${leadId} not found`);
    const updated: CooperationLead = {
      ...existing,
      status,
      ...(assignedOperatorId !== undefined ? { assignedOperatorId } : {}),
      updatedAt: new Date(),
    };
    this.leads.set(leadId, updated);
    return updated;
  }

  // ---------- Support Applications ----------

  async createSupportApplication(
    data: Omit<SupportApplication, "id" | "status" | "createdAt" | "updatedAt">,
  ): Promise<SupportApplication> {
    const now = new Date();
    const application: SupportApplication = {
      id: `app-${this.nextAppId++}`,
      ...data,
      status: "PENDING" as ApplicationStatus,
      createdAt: now,
      updatedAt: now,
    };
    this.supportApplications.set(application.id, application);
    return application;
  }

  async findSupportApplicationById(
    applicationId: string,
  ): Promise<SupportApplication | null> {
    return this.supportApplications.get(applicationId) ?? null;
  }

  async listSupportApplications(
    options: ListSupportApplicationsOptions,
  ): Promise<PaginatedResult<SupportApplication>> {
    let items = [...this.supportApplications.values()];

    if (options.status) {
      items = items.filter((a) => a.status === options.status);
    }

    const limit = options.limit;
    const start = options.cursor
      ? items.findIndex((i) => i.id === options.cursor) + 1
      : 0;
    const slice = items.slice(start, start + limit);
    const hasMore = start + limit < items.length;

    return {
      items: slice,
      nextCursor: hasMore && slice.length > 0 ? slice[slice.length - 1].id : null,
      hasMore,
    };
  }

  async updateSupportApplicationStatus(
    applicationId: string,
    status: ApplicationStatus,
    reviewedBy?: string,
    reviewNote?: string,
  ): Promise<SupportApplication> {
    const existing = this.supportApplications.get(applicationId);
    if (!existing) throw new Error(`Application ${applicationId} not found`);
    const updated: SupportApplication = {
      ...existing,
      status,
      reviewedBy,
      reviewedAt: new Date(),
      reviewNote,
      updatedAt: new Date(),
    };
    this.supportApplications.set(applicationId, updated);
    return updated;
  }

  // ---------- Volunteer Applications ----------

  async createVolunteerApplication(
    data: Omit<VolunteerApplication, "id" | "status" | "createdAt" | "updatedAt">,
  ): Promise<VolunteerApplication> {
    const now = new Date();
    const application: VolunteerApplication = {
      id: `volapp-${this.nextVolAppId++}`,
      ...data,
      status: "PENDING" as VolunteerAppStatus,
      createdAt: now,
      updatedAt: now,
    };
    this.volunteerApplications.set(application.id, application);
    return application;
  }

  async findVolunteerApplicationById(
    applicationId: string,
  ): Promise<VolunteerApplication | null> {
    return this.volunteerApplications.get(applicationId) ?? null;
  }

  async listVolunteerApplications(
    options: ListVolunteerApplicationsOptions,
  ): Promise<PaginatedResult<VolunteerApplication>> {
    let items = [...this.volunteerApplications.values()];

    if (options.status) {
      items = items.filter((a) => a.status === options.status);
    }

    const limit = options.limit;
    const start = options.cursor
      ? items.findIndex((i) => i.id === options.cursor) + 1
      : 0;
    const slice = items.slice(start, start + limit);
    const hasMore = start + limit < items.length;

    return {
      items: slice,
      nextCursor: hasMore && slice.length > 0 ? slice[slice.length - 1].id : null,
      hasMore,
    };
  }

  async updateVolunteerApplicationStatus(
    applicationId: string,
    status: VolunteerAppStatus,
    reviewedBy?: string,
  ): Promise<VolunteerApplication> {
    const existing = this.volunteerApplications.get(applicationId);
    if (!existing) throw new Error(`Volunteer application ${applicationId} not found`);
    const updated: VolunteerApplication = {
      ...existing,
      status,
      reviewedBy,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    };
    this.volunteerApplications.set(applicationId, updated);
    return updated;
  }

  // ---------- Test helpers ----------

  addLead(lead: CooperationLead): void {
    this.leads.set(lead.id, lead);
  }

  addSupportApplication(application: SupportApplication): void {
    this.supportApplications.set(application.id, application);
  }

  addVolunteerApplication(application: VolunteerApplication): void {
    this.volunteerApplications.set(application.id, application);
  }
}
