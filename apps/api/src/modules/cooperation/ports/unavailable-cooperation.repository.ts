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
  async createLead(
    _lead: Omit<CooperationLead, "id" | "status" | "createdAt" | "updatedAt">,
  ): Promise<CooperationLead> {
    throw new LeadUnavailableException();
  }

  async findLeadById(_leadId: string): Promise<CooperationLead | null> {
    throw new LeadUnavailableException();
  }

  async listLeads(_options: ListLeadsOptions): Promise<PaginatedResult<CooperationLead>> {
    throw new LeadUnavailableException();
  }

  async updateLeadStatus(
    _leadId: string,
    _status: LeadStatus,
    _assignedOperatorId?: string,
  ): Promise<CooperationLead> {
    throw new LeadUnavailableException();
  }

  async createSupportApplication(
    _application: Omit<SupportApplication, "id" | "status" | "createdAt" | "updatedAt">,
  ): Promise<SupportApplication> {
    throw new SupportApplicationUnavailableException();
  }

  async findSupportApplicationById(
    _applicationId: string,
  ): Promise<SupportApplication | null> {
    throw new SupportApplicationUnavailableException();
  }

  async listSupportApplications(
    _options: ListSupportApplicationsOptions,
  ): Promise<PaginatedResult<SupportApplication>> {
    throw new SupportApplicationUnavailableException();
  }

  async updateSupportApplicationStatus(
    _applicationId: string,
    _status: ApplicationStatus,
    _reviewedBy?: string,
    _reviewNote?: string,
  ): Promise<SupportApplication> {
    throw new SupportApplicationUnavailableException();
  }

  async createVolunteerApplication(
    _application: Omit<VolunteerApplication, "id" | "status" | "createdAt" | "updatedAt">,
  ): Promise<VolunteerApplication> {
    throw new VolunteerApplicationUnavailableException();
  }

  async findVolunteerApplicationById(
    _applicationId: string,
  ): Promise<VolunteerApplication | null> {
    throw new VolunteerApplicationUnavailableException();
  }

  async listVolunteerApplications(
    _options: ListVolunteerApplicationsOptions,
  ): Promise<PaginatedResult<VolunteerApplication>> {
    throw new VolunteerApplicationUnavailableException();
  }

  async updateVolunteerApplicationStatus(
    _applicationId: string,
    _status: VolunteerAppStatus,
    _reviewedBy?: string,
  ): Promise<VolunteerApplication> {
    throw new VolunteerApplicationUnavailableException();
  }
}
