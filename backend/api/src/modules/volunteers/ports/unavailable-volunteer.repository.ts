import { Injectable } from "@nestjs/common";
import type {
  Volunteer,
  VolunteerServiceTask,
  VolunteerSummary,
  IncidentReport,
} from "../domain/volunteer.types.js";
import { VolunteerUnavailableException } from "../domain/volunteer.errors.js";
import type {
  VolunteerRepositoryPort,
  ListVolunteersOptions,
  ListServiceTasksOptions,
  PaginatedResult,
  CreateVolunteerData,
  CreateIncidentData,
} from "./volunteer-repository.port.js";

@Injectable()
export class UnavailableVolunteerRepository implements VolunteerRepositoryPort {
  async findById(): Promise<Volunteer | null> {
    throw new VolunteerUnavailableException();
  }

  async findByUserId(): Promise<Volunteer | null> {
    throw new VolunteerUnavailableException();
  }

  async list(): Promise<PaginatedResult<VolunteerSummary>> {
    throw new VolunteerUnavailableException();
  }

  async create(): Promise<Volunteer> {
    throw new VolunteerUnavailableException();
  }

  async updateStatus(): Promise<Volunteer> {
    throw new VolunteerUnavailableException();
  }

  async listServiceTasks(): Promise<PaginatedResult<VolunteerServiceTask>> {
    throw new VolunteerUnavailableException();
  }

  async findServiceTaskById(): Promise<VolunteerServiceTask | null> {
    throw new VolunteerUnavailableException();
  }

  async assignServiceTask(): Promise<VolunteerServiceTask> {
    throw new VolunteerUnavailableException();
  }

  async updateServiceTaskStatus(): Promise<VolunteerServiceTask> {
    throw new VolunteerUnavailableException();
  }

  async createIncidentReport(): Promise<IncidentReport> {
    throw new VolunteerUnavailableException();
  }

  async findIncidentById(): Promise<IncidentReport | null> {
    throw new VolunteerUnavailableException();
  }

  async listIncidents(): Promise<PaginatedResult<IncidentReport>> {
    throw new VolunteerUnavailableException();
  }
}
