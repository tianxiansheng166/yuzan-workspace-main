import type { Volunteer, VolunteerSummary, VolunteerServiceTask, IncidentReport } from "../../../../src/modules/volunteers/domain/volunteer.types.js";
import { VolunteerStatus, ServiceType } from "../../../../src/modules/volunteers/domain/volunteer.types.js";

let nextId = 1;
function id(): string {
  return `vol-${nextId++}`;
}

let taskIdCounter = 1;
function taskId(): string {
  return `task-${taskIdCounter++}`;
}

let incidentCounter = 1;
function incidentId(): string {
  return `inc-${incidentCounter++}`;
}

export function volunteer(overrides: Partial<Volunteer> & { schoolId: string }): Volunteer {
  const now = new Date();
  return {
    id: id(),
    userId: "user-1",
    displayName: "测试志愿者",
    phone: "13800138000",
    email: undefined,
    experience: undefined,
    qualifications: [],
    status: VolunteerStatus.APPLIED,
    appliedAt: now,
    qualifiedAt: undefined,
    suspendedReason: undefined,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function volunteerSummary(overrides: Partial<VolunteerSummary> & { schoolId: string }): VolunteerSummary {
  return {
    id: id(),
    userId: "user-1",
    displayName: "测试志愿者",
    status: VolunteerStatus.APPLIED,
    appliedAt: new Date(),
    ...overrides,
  };
}

export function serviceTask(overrides: Partial<VolunteerServiceTask> & { schoolId: string }): VolunteerServiceTask {
  const now = new Date();
  return {
    id: taskId(),
    title: "国通语辅导",
    serviceType: ServiceType.TUTORING,
    classId: undefined,
    studentScope: "全班",
    supervisorTeacherId: "teacher-1",
    requiredQualification: "BASIC_TRAINING",
    assignedVolunteerId: undefined,
    status: "OPEN",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function incidentReport(overrides: Partial<IncidentReport> & { schoolId: string }): IncidentReport {
  const now = new Date();
  return {
    id: incidentId(),
    type: "BEHAVIOR",
    severity: "MEDIUM",
    description: "测试异常事件",
    immediateAction: undefined,
    studentRef: undefined,
    assignedReviewerId: undefined,
    status: "OPEN",
    resolution: undefined,
    reportedBy: "teacher-1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
