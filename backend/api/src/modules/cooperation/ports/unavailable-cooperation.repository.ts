import { Injectable } from "@nestjs/common";
import type {
  CooperationLead,
  LeadStatus,
  SupportApplication,
  ApplicationStatus,
  VolunteerApplication,
  VolunteerAppStatus,
} from "../domain/cooperation.types.js";
import {
  LeadUnavailableException,
  SupportApplicationUnavailableException,
  VolunteerApplicationUnavailableException,
} from "../domain/cooperation.errors.js";
import type {
  CooperationRepositoryPort,
  ListLeadsOptions,
  ListSupportApplicationsOptions,
  ListVolunteerApplicationsOptions,
  PaginatedResult,
} from "./cooperation-repository.port.js";

@Injectable()
export class UnavailableCooperationRepository implements CooperationRepositoryPort {
  createLead(
    _lead: Omit<CooperationLead, "id" | "status" | "createdAt" | "updatedAt">,
  ): Promise<CooperationLead> {
    void _lead;
    return Promise.reject(new LeadUnavailableException());
  }

  findLeadById(_leadId: string): Promise<CooperationLead | null> {
    void _leadId;
    return Promise.reject(new LeadUnavailableException());
  }

  listLeads(
    _options: ListLeadsOptions,
  ): Promise<PaginatedResult<CooperationLead>> {
    void _options;
    return Promise.reject(new LeadUnavailableException());
  }

  updateLeadStatus(
    _leadId: string,
    _status: LeadStatus,
    _assignedOperatorId?: string,
  ): Promise<CooperationLead> {
    void _leadId;
    void _status;
    void _assignedOperatorId;
    return Promise.reject(new LeadUnavailableException());
  }

  createSupportApplication(
    _application: Omit<
      SupportApplication,
      "id" | "status" | "createdAt" | "updatedAt"
    >,
  ): Promise<SupportApplication> {
    void _application;
    return Promise.reject(new SupportApplicationUnavailableException());
  }

  findSupportApplicationById(
    _applicationId: string,
  ): Promise<SupportApplication | null> {
    void _applicationId;
    return Promise.reject(new SupportApplicationUnavailableException());
  }

  listSupportApplications(
    _options: ListSupportApplicationsOptions,
  ): Promise<PaginatedResult<SupportApplication>> {
    void _options;
    return Promise.reject(new SupportApplicationUnavailableException());
  }

  updateSupportApplicationStatus(
    _applicationId: string,
    _status: ApplicationStatus,
    _reviewedBy?: string,
    _reviewNote?: string,
  ): Promise<SupportApplication> {
    void _applicationId;
    void _status;
    void _reviewedBy;
    void _reviewNote;
    return Promise.reject(new SupportApplicationUnavailableException());
  }

  createVolunteerApplication(
    _application: Omit<
      VolunteerApplication,
      "id" | "status" | "createdAt" | "updatedAt"
    >,
  ): Promise<VolunteerApplication> {
    void _application;
    return Promise.reject(new VolunteerApplicationUnavailableException());
  }

  findVolunteerApplicationById(
    _applicationId: string,
  ): Promise<VolunteerApplication | null> {
    void _applicationId;
    return Promise.reject(new VolunteerApplicationUnavailableException());
  }

  listVolunteerApplications(
    _options: ListVolunteerApplicationsOptions,
  ): Promise<PaginatedResult<VolunteerApplication>> {
    void _options;
    return Promise.reject(new VolunteerApplicationUnavailableException());
  }

  updateVolunteerApplicationStatus(
    _applicationId: string,
    _status: VolunteerAppStatus,
    _reviewedBy?: string,
  ): Promise<VolunteerApplication> {
    void _applicationId;
    void _status;
    void _reviewedBy;
    return Promise.reject(new VolunteerApplicationUnavailableException());
  }
}
