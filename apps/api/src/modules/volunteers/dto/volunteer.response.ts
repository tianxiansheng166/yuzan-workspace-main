import type { Volunteer, VolunteerSummary, VolunteerServiceTask, IncidentReport } from "../domain/volunteer.types.js";

export interface VolunteerSummaryResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly userId: string;
  readonly displayName: string;
  readonly status: string;
  readonly appliedAt: string;
}

export function toVolunteerSummaryResponse(v: VolunteerSummary): VolunteerSummaryResponse {
  return {
    id: v.id,
    schoolId: v.schoolId,
    userId: v.userId,
    displayName: v.displayName,
    status: v.status,
    appliedAt: v.appliedAt.toISOString(),
  };
}

export interface VolunteerResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly userId: string;
  readonly displayName: string;
  readonly phone: string;
  readonly email: string | undefined;
  readonly status: string;
  readonly qualifications: readonly string[];
  readonly appliedAt: string;
  readonly qualifiedAt: string | undefined;
  readonly suspendedReason: string | undefined;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toVolunteerResponse(v: Volunteer): VolunteerResponse {
  return {
    id: v.id,
    schoolId: v.schoolId,
    userId: v.userId,
    displayName: v.displayName,
    phone: v.phone,
    email: v.email,
    status: v.status,
    qualifications: v.qualifications,
    appliedAt: v.appliedAt.toISOString(),
    qualifiedAt: v.qualifiedAt?.toISOString(),
    suspendedReason: v.suspendedReason,
    revision: v.revision,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
}

export interface VolunteerSelfResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly displayName: string;
  readonly status: string;
  readonly appliedAt: string;
}

export function toVolunteerSelfResponse(v: Volunteer): VolunteerSelfResponse {
  return {
    id: v.id,
    schoolId: v.schoolId,
    displayName: v.displayName,
    status: v.status,
    appliedAt: v.appliedAt.toISOString(),
  };
}

export interface ServiceTaskResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly title: string;
  readonly serviceType: string;
  readonly classId: string | undefined;
  readonly studentScope: string;
  readonly supervisorTeacherId: string;
  readonly requiredQualification: string;
  readonly assignedVolunteerId: string | undefined;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toServiceTaskResponse(t: VolunteerServiceTask): ServiceTaskResponse {
  return {
    id: t.id,
    schoolId: t.schoolId,
    title: t.title,
    serviceType: t.serviceType,
    classId: t.classId,
    studentScope: t.studentScope,
    supervisorTeacherId: t.supervisorTeacherId,
    requiredQualification: t.requiredQualification,
    assignedVolunteerId: t.assignedVolunteerId,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export interface IncidentReportResponse {
  readonly id: string;
  readonly schoolId: string;
  readonly type: string;
  readonly severity: string;
  readonly description: string;
  readonly immediateAction: string | undefined;
  readonly assignedReviewerId: string | undefined;
  readonly status: string;
  readonly resolution: string | undefined;
  readonly reportedBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toIncidentReportResponse(i: IncidentReport): IncidentReportResponse {
  return {
    id: i.id,
    schoolId: i.schoolId,
    type: i.type,
    severity: i.severity,
    description: i.description,
    immediateAction: i.immediateAction,
    assignedReviewerId: i.assignedReviewerId,
    status: i.status,
    resolution: i.resolution,
    reportedBy: i.reportedBy,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  };
}
