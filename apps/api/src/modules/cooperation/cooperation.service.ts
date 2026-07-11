import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import { MembershipRole } from "../../common/security/index.js";
import {
  LeadNotFoundException,
  LeadForbiddenException,
  SupportApplicationNotFoundException,
  SupportApplicationForbiddenException,
  VolunteerApplicationNotFoundException,
  VolunteerApplicationForbiddenException,
  ConsentRequiredException,
} from "./domain/cooperation.errors.js";
import type {
  CooperationLead,
  SupportApplication,
  VolunteerApplication,
} from "./domain/cooperation.types.js";
import {
  ApplicationStatus,
  LeadStatus,
  VolunteerAppStatus,
} from "./domain/cooperation.types.js";
import {
  toLeadResponse,
  toPublicLeadResponse,
  toPublicSupportApplicationResponse,
  toPublicVolunteerApplicationResponse,
  toSupportApplicationResponse,
  toVolunteerApplicationResponse,
} from "./dto/cooperation.response.js";
import type {
  CooperationRepositoryPort,
  ListLeadsOptions,
  ListSupportApplicationsOptions,
  ListVolunteerApplicationsOptions,
} from "./ports/cooperation-repository.port.js";
import { COOPERATION_REPOSITORY } from "./ports/cooperation-repository.port.js";
import { CooperationPolicy } from "./cooperation.policy.js";

@Injectable()
export class CooperationService {
  private readonly policy = new CooperationPolicy();

  constructor(
    @Inject(COOPERATION_REPOSITORY)
    private readonly repo: CooperationRepositoryPort,
  ) {}

  // ---------- Public: Lead submission ----------

  async submitLead(dto: {
    organizationName: string;
    contactName: string;
    contactChannel: string;
    region?: string;
    schoolType?: string;
    interestedPlan?: string;
    needs?: string;
    consent: boolean;
  }) {
    if (!dto.consent) {
      throw new ConsentRequiredException();
    }

    const lead = await this.repo.createLead({
      organizationName: dto.organizationName,
      contactName: dto.contactName,
      contactChannel: dto.contactChannel,
      ...(dto.region !== undefined ? { region: dto.region } : {}),
      ...(dto.schoolType !== undefined ? { schoolType: dto.schoolType } : {}),
      ...(dto.interestedPlan !== undefined ? { interestedPlan: dto.interestedPlan } : {}),
      ...(dto.needs !== undefined ? { needs: dto.needs } : {}),
      consent: dto.consent,
    });

    return toPublicLeadResponse(lead);
  }

  // ---------- Public: Support application submission ----------

  async submitSupportApplication(dto: {
    organizationName?: string;
    guardianName: string;
    guardianContact: string;
    needCategory: string;
    description: string;
    consent: boolean;
  }) {
    if (!dto.consent) {
      throw new ConsentRequiredException();
    }

    const application = await this.repo.createSupportApplication({
      ...(dto.organizationName !== undefined ? { organizationName: dto.organizationName } : {}),
      guardianName: dto.guardianName,
      guardianContact: dto.guardianContact,
      needCategory: dto.needCategory,
      description: dto.description,
      consent: dto.consent,
    });

    return toPublicSupportApplicationResponse(application);
  }

  // ---------- Public: Volunteer application submission ----------

  async submitVolunteerApplication(dto: {
    applicantName: string;
    contactInfo: string;
    experience?: string;
    availability?: string;
    motivation?: string;
    consent: boolean;
  }) {
    if (!dto.consent) {
      throw new ConsentRequiredException();
    }

    const application = await this.repo.createVolunteerApplication({
      applicantName: dto.applicantName,
      contactInfo: dto.contactInfo,
      ...(dto.experience !== undefined ? { experience: dto.experience } : {}),
      ...(dto.availability !== undefined ? { availability: dto.availability } : {}),
      ...(dto.motivation !== undefined ? { motivation: dto.motivation } : {}),
      consent: dto.consent,
    });

    return toPublicVolunteerApplicationResponse(application);
  }

  // ---------- School-scoped: Leads ----------

  async listLeads(auth: AuthContext, options: ListLeadsOptions) {
    if (!this.policy.canViewLeads(auth)) {
      throw new LeadForbiddenException();
    }

    const result = await this.repo.listLeads(options);
    return {
      items: result.items.map(toLeadResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async getLead(auth: AuthContext, leadId: string) {
    if (!this.policy.canViewLeads(auth)) {
      throw new LeadForbiddenException();
    }

    const lead = await this.repo.findLeadById(leadId);
    if (!lead) {
      throw new LeadNotFoundException();
    }

    return toLeadResponse(lead);
  }

  async updateLeadStatus(
    auth: AuthContext,
    leadId: string,
    status: LeadStatus,
    assignedOperatorId?: string,
  ) {
    if (!this.policy.canManageLeads(auth)) {
      throw new LeadForbiddenException();
    }

    const existing = await this.repo.findLeadById(leadId);
    if (!existing) {
      throw new LeadNotFoundException();
    }

    const updated = await this.repo.updateLeadStatus(
      leadId,
      status,
      assignedOperatorId,
    );
    return toLeadResponse(updated);
  }

  // ---------- School-scoped: Support applications ----------

  async listSupportApplications(
    auth: AuthContext,
    options: ListSupportApplicationsOptions,
  ) {
    if (!this.policy.canViewApplications(auth)) {
      throw new SupportApplicationForbiddenException();
    }

    const result = await this.repo.listSupportApplications(options);
    return {
      items: result.items.map(toSupportApplicationResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async getSupportApplication(auth: AuthContext, applicationId: string) {
    if (!this.policy.canViewApplications(auth)) {
      throw new SupportApplicationForbiddenException();
    }

    const application = await this.repo.findSupportApplicationById(applicationId);
    if (!application) {
      throw new SupportApplicationNotFoundException();
    }

    return toSupportApplicationResponse(application);
  }

  async reviewSupportApplication(
    auth: AuthContext,
    applicationId: string,
    action: "approve" | "reject",
    note?: string,
  ) {
    if (!this.policy.canReviewApplications(auth)) {
      throw new SupportApplicationForbiddenException();
    }

    const existing = await this.repo.findSupportApplicationById(applicationId);
    if (!existing) {
      throw new SupportApplicationNotFoundException();
    }

    const status: ApplicationStatus =
      action === "approve" ? ApplicationStatus.APPROVED : ApplicationStatus.REJECTED;

    const reviewedBy = auth.principal.userId;
    const updated = await this.repo.updateSupportApplicationStatus(
      applicationId,
      status,
      reviewedBy,
      note,
    );
    return toSupportApplicationResponse(updated);
  }

  // ---------- School-scoped: Volunteer applications ----------

  async listVolunteerApplications(
    auth: AuthContext,
    options: ListVolunteerApplicationsOptions,
  ) {
    if (!this.policy.canViewApplications(auth)) {
      throw new VolunteerApplicationForbiddenException();
    }

    const result = await this.repo.listVolunteerApplications(options);
    return {
      items: result.items.map(toVolunteerApplicationResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async getVolunteerApplication(auth: AuthContext, applicationId: string) {
    if (!this.policy.canViewApplications(auth)) {
      throw new VolunteerApplicationForbiddenException();
    }

    const application = await this.repo.findVolunteerApplicationById(applicationId);
    if (!application) {
      throw new VolunteerApplicationNotFoundException();
    }

    return toVolunteerApplicationResponse(application);
  }

  async reviewVolunteerApplication(
    auth: AuthContext,
    applicationId: string,
    action: "approve" | "reject",
  ) {
    if (!this.policy.canReviewApplications(auth)) {
      throw new VolunteerApplicationForbiddenException();
    }

    const existing = await this.repo.findVolunteerApplicationById(applicationId);
    if (!existing) {
      throw new VolunteerApplicationNotFoundException();
    }

    const status: VolunteerAppStatus =
      action === "approve" ? VolunteerAppStatus.ACCEPTED : VolunteerAppStatus.REJECTED;

    const reviewedBy = auth.principal.userId;
    const updated = await this.repo.updateVolunteerApplicationStatus(
      applicationId,
      status,
      reviewedBy,
    );
    return toVolunteerApplicationResponse(updated);
  }
}
