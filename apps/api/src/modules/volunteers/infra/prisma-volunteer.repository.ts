import { Injectable } from "@nestjs/common";
import type { Prisma } from "@yuzan/database";
import { PrismaService } from "../../../shared/database/prisma.service.js";
import {
  ServiceType,
  VolunteerStatus,
  type IncidentReport,
  type Volunteer,
  type VolunteerServiceTask,
  type VolunteerSummary,
} from "../domain/volunteer.types.js";
import type {
  CreateIncidentData,
  CreateVolunteerData,
  ListServiceTasksOptions,
  ListVolunteersOptions,
  PaginatedResult,
  VolunteerRepositoryPort,
} from "../ports/volunteer-repository.port.js";

@Injectable()
export class PrismaVolunteerRepository implements VolunteerRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(
    schoolId: string,
    volunteerId: string,
  ): Promise<Volunteer | null> {
    const row = await this.prisma.volunteerProfile.findFirst({
      where: { schoolId, id: volunteerId },
    });
    return row ? toVolunteer(row) : null;
  }

  async findByUserId(
    schoolId: string,
    userId: string,
  ): Promise<Volunteer | null> {
    const row = await this.prisma.volunteerProfile.findUnique({
      where: { schoolId_userId: { schoolId, userId } },
    });
    return row ? toVolunteer(row) : null;
  }

  async list(
    schoolId: string,
    options: ListVolunteersOptions,
  ): Promise<PaginatedResult<VolunteerSummary>> {
    const rows = await this.prisma.volunteerProfile.findMany({
      where: {
        schoolId,
        ...(options.status ? { status: options.status } : {}),
        ...(options.cursor ? { id: { gt: options.cursor } } : {}),
      },
      orderBy: { id: "asc" },
      take: options.limit + 1,
    });
    const hasMore = rows.length > options.limit;
    const items = hasMore ? rows.slice(0, options.limit) : rows;
    return {
      items: items.map((row) => ({
        id: row.id,
        schoolId: row.schoolId,
        userId: row.userId,
        displayName: row.displayName,
        status: row.status as VolunteerStatus,
        appliedAt: row.appliedAt,
      })),
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
      hasMore,
    };
  }

  async create(
    schoolId: string,
    data: CreateVolunteerData,
  ): Promise<Volunteer> {
    const row = await this.prisma.volunteerProfile.create({
      data: {
        schoolId,
        userId: data.userId,
        displayName: data.displayName,
        phone: data.phone,
        status: VolunteerStatus.APPLIED,
        ...(data.email ? { email: data.email } : {}),
        ...(data.experience ? { experience: data.experience } : {}),
      },
    });
    return toVolunteer(row);
  }

  async updateStatus(
    schoolId: string,
    volunteerId: string,
    status: VolunteerStatus,
    revision: number,
    extra?: { suspendedReason?: string; qualifiedAt?: Date },
  ): Promise<Volunteer> {
    const result = await this.prisma.volunteerProfile.updateMany({
      where: { schoolId, id: volunteerId, revision },
      data: {
        status,
        revision: { increment: 1 },
        ...(extra?.suspendedReason !== undefined
          ? { suspendedReason: extra.suspendedReason }
          : {}),
        ...(extra?.qualifiedAt ? { qualifiedAt: extra.qualifiedAt } : {}),
      },
    });
    if (result.count !== 1) throw new Error("VOLUNTEER_REVISION_CONFLICT");
    const updated = await this.findById(schoolId, volunteerId);
    if (!updated) throw new Error("VOLUNTEER_NOT_FOUND");
    return updated;
  }

  async listServiceTasks(
    schoolId: string,
    options: ListServiceTasksOptions,
  ): Promise<PaginatedResult<VolunteerServiceTask>> {
    const rows = await this.prisma.volunteerServiceTask.findMany({
      where: {
        schoolId,
        ...(options.assignedVolunteerId
          ? { assignedVolunteerId: options.assignedVolunteerId }
          : {}),
        ...(options.status ? { status: options.status } : {}),
        ...(options.cursor ? { id: { gt: options.cursor } } : {}),
      },
      orderBy: { id: "asc" },
      take: options.limit + 1,
    });
    const hasMore = rows.length > options.limit;
    const items = hasMore ? rows.slice(0, options.limit) : rows;
    return {
      items: items.map(toServiceTask),
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
      hasMore,
    };
  }

  async findServiceTaskById(
    schoolId: string,
    taskId: string,
  ): Promise<VolunteerServiceTask | null> {
    const row = await this.prisma.volunteerServiceTask.findFirst({
      where: { schoolId, id: taskId },
    });
    return row ? toServiceTask(row) : null;
  }

  async assignServiceTask(
    schoolId: string,
    taskId: string,
    volunteerId: string,
  ): Promise<VolunteerServiceTask> {
    const result = await this.prisma.volunteerServiceTask.updateMany({
      where: { schoolId, id: taskId },
      data: { assignedVolunteerId: volunteerId, status: "ASSIGNED" },
    });
    if (result.count !== 1) throw new Error("VOLUNTEER_SERVICE_TASK_NOT_FOUND");
    const task = await this.findServiceTaskById(schoolId, taskId);
    if (!task) throw new Error("VOLUNTEER_SERVICE_TASK_NOT_FOUND");
    return task;
  }

  async createIncidentReport(
    schoolId: string,
    data: CreateIncidentData,
  ): Promise<IncidentReport> {
    const row = await this.prisma.volunteerIncident.create({
      data: { schoolId, ...data },
    });
    return toIncident(row);
  }

  async findIncidentById(
    schoolId: string,
    incidentId: string,
  ): Promise<IncidentReport | null> {
    const row = await this.prisma.volunteerIncident.findFirst({
      where: { schoolId, id: incidentId },
    });
    return row ? toIncident(row) : null;
  }

  async listIncidents(
    schoolId: string,
    options: {
      severity?: string;
      status?: string;
      limit: number;
      cursor?: string;
    },
  ): Promise<PaginatedResult<IncidentReport>> {
    const rows = await this.prisma.volunteerIncident.findMany({
      where: {
        schoolId,
        ...(options.severity ? { severity: options.severity } : {}),
        ...(options.status ? { status: options.status } : {}),
        ...(options.cursor ? { id: { gt: options.cursor } } : {}),
      },
      orderBy: { id: "asc" },
      take: options.limit + 1,
    });
    const hasMore = rows.length > options.limit;
    const items = hasMore ? rows.slice(0, options.limit) : rows;
    return {
      items: items.map(toIncident),
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
      hasMore,
    };
  }
}

function toVolunteer(row: Record<string, unknown>): Volunteer {
  return {
    id: row.id as string,
    schoolId: row.schoolId as string,
    userId: row.userId as string,
    status: row.status as VolunteerStatus,
    displayName: row.displayName as string,
    phone: row.phone as string,
    qualifications: row.qualifications as string[],
    appliedAt: row.appliedAt as Date,
    revision: row.revision as number,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
    ...(row.email ? { email: row.email as string } : {}),
    ...(row.experience ? { experience: row.experience as string } : {}),
    ...(row.qualifiedAt ? { qualifiedAt: row.qualifiedAt as Date } : {}),
    ...(row.suspendedReason
      ? { suspendedReason: row.suspendedReason as string }
      : {}),
  };
}

function toServiceTask(row: Record<string, unknown>): VolunteerServiceTask {
  return {
    id: row.id as string,
    schoolId: row.schoolId as string,
    title: row.title as string,
    serviceType: row.serviceType as ServiceType,
    studentScope: row.studentScope as string,
    supervisorTeacherId: row.supervisorTeacherId as string,
    requiredQualification: row.requiredQualification as string,
    status: row.status as string,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
    ...(row.classId ? { classId: row.classId as string } : {}),
    ...(row.assignedVolunteerId
      ? { assignedVolunteerId: row.assignedVolunteerId as string }
      : {}),
  };
}

function toIncident(row: Record<string, unknown>): IncidentReport {
  return {
    id: row.id as string,
    schoolId: row.schoolId as string,
    type: row.type as string,
    severity: row.severity as string,
    description: row.description as string,
    status: row.status as string,
    reportedBy: row.reportedBy as string,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
    ...(row.immediateAction
      ? { immediateAction: row.immediateAction as string }
      : {}),
    ...(row.studentRef ? { studentRef: row.studentRef as string } : {}),
    ...(row.assignedReviewerId
      ? { assignedReviewerId: row.assignedReviewerId as string }
      : {}),
    ...(row.resolution ? { resolution: row.resolution as string } : {}),
  };
}
