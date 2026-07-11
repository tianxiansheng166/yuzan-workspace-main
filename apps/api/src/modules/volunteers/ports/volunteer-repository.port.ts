import type {
  Volunteer,
  VolunteerServiceTask,
  VolunteerStatus,
  VolunteerSummary,
  IncidentReport,
} from "../domain/volunteer.types.js";

export const VOLUNTEER_REPOSITORY = Symbol("VOLUNTEER_REPOSITORY");

export interface ListVolunteersOptions {
  readonly status?: VolunteerStatus | undefined;
  readonly limit: number;
  readonly cursor?: string | undefined;
}

export interface ListServiceTasksOptions {
  readonly assignedVolunteerId?: string | undefined;
  readonly status?: string | undefined;
  readonly limit: number;
  readonly cursor?: string | undefined;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface VolunteerRepositoryPort {
  findById(schoolId: string, volunteerId: string): Promise<Volunteer | null>;
  findByUserId(schoolId: string, userId: string): Promise<Volunteer | null>;
  list(schoolId: string, options: ListVolunteersOptions): Promise<PaginatedResult<VolunteerSummary>>;
  create(schoolId: string, data: CreateVolunteerData): Promise<Volunteer>;
  updateStatus(schoolId: string, volunteerId: string, status: VolunteerStatus, revision: number, extra?: { suspendedReason?: string | undefined; qualifiedAt?: Date | undefined }): Promise<Volunteer>;
  listServiceTasks(schoolId: string, options: ListServiceTasksOptions): Promise<PaginatedResult<VolunteerServiceTask>>;
  findServiceTaskById(schoolId: string, taskId: string): Promise<VolunteerServiceTask | null>;
  assignServiceTask(schoolId: string, taskId: string, volunteerId: string): Promise<VolunteerServiceTask>;
  createIncidentReport(schoolId: string, data: CreateIncidentData): Promise<IncidentReport>;
  findIncidentById(schoolId: string, incidentId: string): Promise<IncidentReport | null>;
  listIncidents(schoolId: string, options: { severity?: string | undefined; status?: string | undefined; limit: number; cursor?: string | undefined }): Promise<PaginatedResult<IncidentReport>>;
}

export interface CreateVolunteerData {
  readonly userId: string;
  readonly displayName: string;
  readonly phone: string;
  readonly email?: string;
  readonly experience?: string;
}

export interface CreateIncidentData {
  readonly type: string;
  readonly severity: string;
  readonly description: string;
  readonly immediateAction?: string;
  readonly studentRef?: string;
  readonly reportedBy: string;
}
