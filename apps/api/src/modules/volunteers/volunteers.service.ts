import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import { canTransition, isQualified, VolunteerStatus } from "./domain/volunteer.types.js";
import {
  VolunteerForbiddenException,
  VolunteerInvalidTransitionException,
  VolunteerNotFoundException,
  VolunteerNotQualifiedException,
  ServiceTaskForbiddenException,
  ServiceTaskNotFoundException,
  IncidentReportForbiddenException,
  IncidentReportNotFoundException,
} from "./domain/volunteer.errors.js";
import { VolunteersPolicy } from "./volunteers.policy.js";
import type { VolunteerRepositoryPort, ListVolunteersOptions, ListServiceTasksOptions, CreateVolunteerData, CreateIncidentData } from "./ports/volunteer-repository.port.js";
import { VOLUNTEER_REPOSITORY } from "./ports/volunteer-repository.port.js";
import { toVolunteerResponse, toVolunteerSummaryResponse, toVolunteerSelfResponse, toServiceTaskResponse, toIncidentReportResponse } from "./dto/volunteer.response.js";

@Injectable()
export class VolunteersService {
  private readonly policy = new VolunteersPolicy();

  constructor(
    @Inject(VOLUNTEER_REPOSITORY)
    private readonly repo: VolunteerRepositoryPort,
  ) {}

  async apply(auth: AuthContext, schoolId: string, data: CreateVolunteerData) {
    if (!this.policy.canApply(auth, schoolId)) {
      throw new VolunteerForbiddenException();
    }

    const volunteer = await this.repo.create(schoolId, {
      ...data,
      userId: auth.principal.userId,
    });
    return toVolunteerResponse(volunteer);
  }

  async listVolunteers(auth: AuthContext, schoolId: string, options: ListVolunteersOptions) {
    if (!this.policy.canListVolunteers(auth, schoolId)) {
      throw new VolunteerForbiddenException();
    }

    const result = await this.repo.list(schoolId, options);
    return {
      items: result.items.map(toVolunteerSummaryResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async getVolunteer(auth: AuthContext, schoolId: string, volunteerId: string) {
    if (!this.policy.canViewVolunteer(auth, schoolId)) {
      throw new VolunteerForbiddenException();
    }

    const volunteer = await this.repo.findById(schoolId, volunteerId);
    if (!volunteer) {
      throw new VolunteerNotFoundException();
    }
    return toVolunteerResponse(volunteer);
  }

  async getMyProfile(auth: AuthContext, schoolId: string) {
    if (!this.policy.canViewOwnVolunteerProfile(auth, schoolId)) {
      throw new VolunteerForbiddenException();
    }

    const volunteer = await this.repo.findByUserId(schoolId, auth.principal.userId);
    if (!volunteer) {
      throw new VolunteerNotFoundException();
    }
    return toVolunteerSelfResponse(volunteer);
  }

  async transitionStatus(
    auth: AuthContext,
    schoolId: string,
    volunteerId: string,
    newStatus: VolunteerStatus,
    revision: number,
    extra?: { suspendedReason?: string },
  ) {
    if (!this.policy.canTransitionVolunteerStatus(auth, schoolId)) {
      throw new VolunteerForbiddenException();
    }

    const volunteer = await this.repo.findById(schoolId, volunteerId);
    if (!volunteer) {
      throw new VolunteerNotFoundException();
    }

    if (!canTransition(volunteer.status, newStatus)) {
      throw new VolunteerInvalidTransitionException();
    }

    const updateExtra: { suspendedReason?: string; qualifiedAt?: Date } = {};
    if (newStatus === VolunteerStatus.SUSPENDED && extra?.suspendedReason) {
      updateExtra.suspendedReason = extra.suspendedReason;
    }
    if (isQualified(newStatus)) {
      updateExtra.qualifiedAt = new Date();
    }

    const updated = await this.repo.updateStatus(schoolId, volunteerId, newStatus, revision, updateExtra);
    return toVolunteerResponse(updated);
  }

  async listServiceTasks(auth: AuthContext, schoolId: string, options: ListServiceTasksOptions) {
    if (!this.policy.canManageServiceTasks(auth, schoolId)) {
      throw new ServiceTaskForbiddenException();
    }

    const result = await this.repo.listServiceTasks(schoolId, options);
    return {
      items: result.items.map(toServiceTaskResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async listMyServiceTasks(auth: AuthContext, schoolId: string, limit: number, cursor?: string) {
    if (!this.policy.canViewAssignedServiceTasks(auth, schoolId)) {
      throw new ServiceTaskForbiddenException();
    }

    const volunteer = await this.repo.findByUserId(schoolId, auth.principal.userId);
    if (!volunteer) {
      throw new VolunteerNotFoundException();
    }

    if (!isQualified(volunteer.status)) {
      throw new VolunteerNotQualifiedException();
    }

    const result = await this.repo.listServiceTasks(schoolId, {
      assignedVolunteerId: volunteer.id,
      limit,
      cursor,
    });
    return {
      items: result.items.map(toServiceTaskResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async assignServiceTask(auth: AuthContext, schoolId: string, taskId: string, volunteerId: string) {
    if (!this.policy.canManageServiceTasks(auth, schoolId)) {
      throw new ServiceTaskForbiddenException();
    }

    const task = await this.repo.findServiceTaskById(schoolId, taskId);
    if (!task) {
      throw new ServiceTaskNotFoundException();
    }

    const volunteer = await this.repo.findById(schoolId, volunteerId);
    if (!volunteer) {
      throw new VolunteerNotFoundException();
    }

    if (!isQualified(volunteer.status)) {
      throw new VolunteerNotQualifiedException();
    }

    const updated = await this.repo.assignServiceTask(schoolId, taskId, volunteerId);
    return toServiceTaskResponse(updated);
  }

  async reportIncident(auth: AuthContext, schoolId: string, data: CreateIncidentData) {
    if (!this.policy.canReportIncident(auth, schoolId)) {
      throw new IncidentReportForbiddenException();
    }

    const incident = await this.repo.createIncidentReport(schoolId, data);
    return toIncidentReportResponse(incident);
  }

  async listIncidents(auth: AuthContext, schoolId: string, options: { severity?: string; status?: string; limit: number; cursor?: string }) {
    if (!this.policy.canViewIncidents(auth, schoolId)) {
      throw new IncidentReportForbiddenException();
    }

    const result = await this.repo.listIncidents(schoolId, options);
    return {
      items: result.items.map(toIncidentReportResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async getIncident(auth: AuthContext, schoolId: string, incidentId: string) {
    if (!this.policy.canViewIncidents(auth, schoolId)) {
      throw new IncidentReportForbiddenException();
    }

    const incident = await this.repo.findIncidentById(schoolId, incidentId);
    if (!incident) {
      throw new IncidentReportNotFoundException();
    }
    return toIncidentReportResponse(incident);
  }
}
