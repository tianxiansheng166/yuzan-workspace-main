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
  PaginatedResult,
} from "./volunteer-repository.port.js";

@Injectable()
export class UnavailableVolunteerRepository implements VolunteerRepositoryPort {
  findById(): Promise<Volunteer | null> {
    return Promise.reject(new VolunteerUnavailableException());
  }

  findByUserId(): Promise<Volunteer | null> {
    return Promise.reject(new VolunteerUnavailableException());
  }

  list(): Promise<PaginatedResult<VolunteerSummary>> {
    return Promise.reject(new VolunteerUnavailableException());
  }

  create(): Promise<Volunteer> {
    return Promise.reject(new VolunteerUnavailableException());
  }

  updateStatus(): Promise<Volunteer> {
    return Promise.reject(new VolunteerUnavailableException());
  }

  listServiceTasks(): Promise<PaginatedResult<VolunteerServiceTask>> {
    return Promise.reject(new VolunteerUnavailableException());
  }

  findServiceTaskById(): Promise<VolunteerServiceTask | null> {
    return Promise.reject(new VolunteerUnavailableException());
  }

  assignServiceTask(): Promise<VolunteerServiceTask> {
    return Promise.reject(new VolunteerUnavailableException());
  }

  updateServiceTaskStatus(): Promise<VolunteerServiceTask> {
    return Promise.reject(new VolunteerUnavailableException());
  }

  createIncidentReport(): Promise<IncidentReport> {
    return Promise.reject(new VolunteerUnavailableException());
  }

  findIncidentById(): Promise<IncidentReport | null> {
    return Promise.reject(new VolunteerUnavailableException());
  }

  listIncidents(): Promise<PaginatedResult<IncidentReport>> {
    return Promise.reject(new VolunteerUnavailableException());
  }
}
