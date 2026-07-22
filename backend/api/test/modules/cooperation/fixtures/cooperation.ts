import type {
  CooperationLead,
  SupportApplication,
  VolunteerApplication,
} from "../../../../src/modules/cooperation/domain/cooperation.types.js";
import {
  LeadStatus,
  ApplicationStatus,
  VolunteerAppStatus,
} from "../../../../src/modules/cooperation/domain/cooperation.types.js";

let nextLeadId = 1;
function leadId(): string {
  return `lead-${nextLeadId++}`;
}

let nextAppId = 1;
function appId(): string {
  return `app-${nextAppId++}`;
}

let nextVolAppId = 1;
function volAppId(): string {
  return `volapp-${nextVolAppId++}`;
}

export function cooperationLead(
  overrides: Partial<CooperationLead> = {},
): CooperationLead {
  const now = new Date();
  return {
    id: leadId(),
    organizationName: "测试学校",
    contactName: "张主任",
    contactChannel: "13800138000",
    region: undefined,
    schoolType: undefined,
    interestedPlan: undefined,
    needs: undefined,
    consent: true,
    status: LeadStatus.NEW,
    assignedOperatorId: undefined,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function supportApplication(
  overrides: Partial<SupportApplication> = {},
): SupportApplication {
  const now = new Date();
  return {
    id: appId(),
    schoolId: undefined,
    organizationName: undefined,
    guardianName: "李家长",
    guardianContact: "13900139000",
    needCategory: "学费资助",
    description: "家庭经济困难，需要学费资助",
    consent: true,
    status: ApplicationStatus.PENDING,
    reviewedBy: undefined,
    reviewedAt: undefined,
    reviewNote: undefined,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function volunteerApplication(
  overrides: Partial<VolunteerApplication> = {},
): VolunteerApplication {
  const now = new Date();
  return {
    id: volAppId(),
    applicantName: "王志愿者",
    contactInfo: "13700137000",
    experience: undefined,
    availability: undefined,
    motivation: undefined,
    consent: true,
    status: VolunteerAppStatus.PENDING,
    reviewedBy: undefined,
    reviewedAt: undefined,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
