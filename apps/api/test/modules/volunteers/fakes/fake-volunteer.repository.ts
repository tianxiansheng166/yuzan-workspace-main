import type { Volunteer, VolunteerSummary, VolunteerServiceTask, IncidentReport, VolunteerStatus } from "../../../../src/modules/volunteers/domain/volunteer.types.js";
import type { VolunteerRepositoryPort, ListVolunteersOptions, ListServiceTasksOptions, PaginatedResult, CreateVolunteerData, CreateIncidentData } from "../../../../src/modules/volunteers/ports/volunteer-repository.port.js";

export class FakeVolunteerRepository implements VolunteerRepositoryPort {
  private volunteers: Map<string, Volunteer> = new Map();
  private serviceTasks: Map<string, VolunteerServiceTask> = new Map();
  private incidents: Map<string, IncidentReport> = new Map();
  private nextId = 1;

  async findById(schoolId: string, volunteerId: string): Promise<Volunteer | null> {
    const v = this.volunteers.get(volunteerId);
    return v && v.schoolId === schoolId ? v : null;
  }

  async findByUserId(schoolId: string, userId: string): Promise<Volunteer | null> {
    for (const v of this.volunteers.values()) {
      if (v.schoolId === schoolId && v.userId === userId) return v;
    }
    return null;
  }

  async list(schoolId: string, options: ListVolunteersOptions): Promise<PaginatedResult<VolunteerSummary>> {
    let items = [...this.volunteers.values()]
      .filter((v) => v.schoolId === schoolId)
      .map((v): VolunteerSummary => ({
        id: v.id,
        schoolId: v.schoolId,
        userId: v.userId,
        displayName: v.displayName,
        status: v.status,
        appliedAt: v.appliedAt,
      }));

    if (options.status) {
      items = items.filter((v) => v.status === options.status);
    }

    const limit = options.limit;
    const start = options.cursor ? items.findIndex((i) => i.id === options.cursor) + 1 : 0;
    const slice = items.slice(start, start + limit);
    const hasMore = start + limit < items.length;

    return {
      items: slice,
      nextCursor: hasMore && slice.length > 0 ? slice[slice.length - 1].id : null,
      hasMore,
    };
  }

  async create(schoolId: string, data: CreateVolunteerData): Promise<Volunteer> {
    const now = new Date();
    const v: Volunteer = {
      id: `vol-${this.nextId++}`,
      schoolId,
      userId: data.userId,
      displayName: data.displayName,
      phone: data.phone,
      email: data.email,
      experience: data.experience,
      status: "APPLIED" as VolunteerStatus,
      qualifications: [],
      appliedAt: now,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.volunteers.set(v.id, v);
    return v;
  }

  async updateStatus(schoolId: string, volunteerId: string, status: VolunteerStatus, _revision: number, extra?: { suspendedReason?: string; qualifiedAt?: Date }): Promise<Volunteer> {
    const v = this.volunteers.get(volunteerId);
    if (!v || v.schoolId !== schoolId) throw new Error("not found");
    const updated = { ...v, status, updatedAt: new Date(), ...extra };
    this.volunteers.set(volunteerId, updated);
    return updated;
  }

  async listServiceTasks(schoolId: string, options: ListServiceTasksOptions): Promise<PaginatedResult<VolunteerServiceTask>> {
    let items = [...this.serviceTasks.values()].filter((t) => t.schoolId === schoolId);
    if (options.assignedVolunteerId) {
      items = items.filter((t) => t.assignedVolunteerId === options.assignedVolunteerId);
    }
    if (options.status) {
      items = items.filter((t) => t.status === options.status);
    }
    const limit = options.limit;
    const slice = items.slice(0, limit);
    return { items: slice, nextCursor: null, hasMore: false };
  }

  async findServiceTaskById(schoolId: string, taskId: string): Promise<VolunteerServiceTask | null> {
    const t = this.serviceTasks.get(taskId);
    return t && t.schoolId === schoolId ? t : null;
  }

  async assignServiceTask(schoolId: string, taskId: string, volunteerId: string): Promise<VolunteerServiceTask> {
    const t = this.serviceTasks.get(taskId);
    if (!t || t.schoolId !== schoolId) throw new Error("not found");
    const updated = { ...t, assignedVolunteerId: volunteerId, status: "ASSIGNED", updatedAt: new Date() };
    this.serviceTasks.set(taskId, updated);
    return updated;
  }

  async createIncidentReport(schoolId: string, data: CreateIncidentData): Promise<IncidentReport> {
    const now = new Date();
    const inc: IncidentReport = {
      id: `inc-${this.nextId++}`,
      schoolId,
      type: data.type,
      severity: data.severity,
      description: data.description,
      immediateAction: data.immediateAction,
      studentRef: data.studentRef,
      status: "OPEN",
      reportedBy: data.reportedBy,
      createdAt: now,
      updatedAt: now,
    };
    this.incidents.set(inc.id, inc);
    return inc;
  }

  async findIncidentById(schoolId: string, incidentId: string): Promise<IncidentReport | null> {
    const i = this.incidents.get(incidentId);
    return i && i.schoolId === schoolId ? i : null;
  }

  async listIncidents(schoolId: string, options: { severity?: string; status?: string; limit: number; cursor?: string }): Promise<PaginatedResult<IncidentReport>> {
    let items = [...this.incidents.values()].filter((i) => i.schoolId === schoolId);
    if (options.severity) items = items.filter((i) => i.severity === options.severity);
    if (options.status) items = items.filter((i) => i.status === options.status);
    const slice = items.slice(0, options.limit);
    return { items: slice, nextCursor: null, hasMore: false };
  }

  addVolunteer(v: Volunteer): void {
    this.volunteers.set(v.id, v);
  }

  addServiceTask(t: VolunteerServiceTask): void {
    this.serviceTasks.set(t.id, t);
  }
}
