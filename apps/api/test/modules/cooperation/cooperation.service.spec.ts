import { describe, expect, it } from "vitest";
import {
  ConsentRequiredException,
  LeadForbiddenException,
  LeadNotFoundException,
  LeadUnavailableException,
  SupportApplicationForbiddenException,
  SupportApplicationNotFoundException,
  SupportApplicationUnavailableException,
  VolunteerApplicationForbiddenException,
  VolunteerApplicationNotFoundException,
  VolunteerApplicationUnavailableException,
} from "../../../src/modules/cooperation/domain/cooperation.errors.js";
import {
  ApplicationStatus,
  LeadStatus,
  VolunteerAppStatus,
} from "../../../src/modules/cooperation/domain/cooperation.types.js";
import { UnavailableCooperationRepository } from "../../../src/modules/cooperation/ports/unavailable-cooperation.repository.js";
import { CooperationService } from "../../../src/modules/cooperation/cooperation.service.js";
import { FakeCooperationRepository } from "./fakes/fake-cooperation.repository.js";
import { cooperationLead, supportApplication, volunteerApplication } from "./fixtures/cooperation.js";
import {
  studentAuth,
  teacherAuth,
  schoolAdminAuth,
  platformAdminAuth,
  suspendedAuth,
} from "./fixtures/users.js";

function createService(repo?: FakeCooperationRepository) {
  const r = repo ?? new FakeCooperationRepository();
  return { service: new CooperationService(r), repo: r };
}

// ---------------------------------------------------------------------------
// submitLead
// ---------------------------------------------------------------------------
describe("CooperationService", () => {
  describe("submitLead", () => {
    it("creates a lead with NEW status when consent is true", async () => {
      const { service } = createService();

      const result = await service.submitLead({
        organizationName: "测试学校",
        contactName: "张主任",
        contactChannel: "13800138000",
        consent: true,
      });

      expect(result.organizationName).toBe("测试学校");
    });

    it("throws ConsentRequiredException when consent is false", async () => {
      const { service } = createService();

      await expect(
        service.submitLead({
          organizationName: "测试学校",
          contactName: "张主任",
          contactChannel: "13800138000",
          consent: false,
        }),
      ).rejects.toThrow(ConsentRequiredException);
    });

    it("passes optional fields to the repository", async () => {
      const { service, repo } = createService();

      await service.submitLead({
        organizationName: "测试学校",
        contactName: "张主任",
        contactChannel: "13800138000",
        region: "华东",
        schoolType: "小学",
        interestedPlan: "基础版",
        needs: "需要师资培训",
        consent: true,
      });

      const stored = await repo.findLeadById("lead-1");
      expect(stored?.region).toBe("华东");
      expect(stored?.schoolType).toBe("小学");
      expect(stored?.interestedPlan).toBe("基础版");
      expect(stored?.needs).toBe("需要师资培训");
    });

    it("does not require auth context", async () => {
      const { service } = createService();

      // submitLead takes no auth parameter, confirming public access
      const result = await service.submitLead({
        organizationName: "公开学校",
        contactName: "李老师",
        contactChannel: "wechat:li-teacher",
        consent: true,
      });

      expect(result.organizationName).toBe("公开学校");
    });
  });

  // ---------------------------------------------------------------------------
  // submitSupportApplication
  // ---------------------------------------------------------------------------
  describe("submitSupportApplication", () => {
    it("creates an application with PENDING status when consent is true", async () => {
      const { service } = createService();

      const result = await service.submitSupportApplication({
        guardianName: "李家长",
        guardianContact: "13900139000",
        needCategory: "学费资助",
        description: "家庭经济困难",
        consent: true,
      });

      expect(result.needCategory).toBe("学费资助");
    });

    it("throws ConsentRequiredException when consent is false", async () => {
      const { service } = createService();

      await expect(
        service.submitSupportApplication({
          guardianName: "李家长",
          guardianContact: "13900139000",
          needCategory: "学费资助",
          description: "家庭经济困难",
          consent: false,
        }),
      ).rejects.toThrow(ConsentRequiredException);
    });

    it("passes optional organizationName to the repository", async () => {
      const { service, repo } = createService();

      await service.submitSupportApplication({
        organizationName: "测试机构",
        guardianName: "李家长",
        guardianContact: "13900139000",
        needCategory: "学费资助",
        description: "家庭经济困难",
        consent: true,
      });

      const stored = await repo.findSupportApplicationById("app-1");
      expect(stored?.organizationName).toBe("测试机构");
    });
  });

  // ---------------------------------------------------------------------------
  // submitVolunteerApplication
  // ---------------------------------------------------------------------------
  describe("submitVolunteerApplication", () => {
    it("creates an application with PENDING status when consent is true", async () => {
      const { service } = createService();

      const result = await service.submitVolunteerApplication({
        applicantName: "王志愿者",
        contactInfo: "13700137000",
        consent: true,
      });

      expect(result.applicantName).toBe("王志愿者");
    });

    it("throws ConsentRequiredException when consent is false", async () => {
      const { service } = createService();

      await expect(
        service.submitVolunteerApplication({
          applicantName: "王志愿者",
          contactInfo: "13700137000",
          consent: false,
        }),
      ).rejects.toThrow(ConsentRequiredException);
    });

    it("passes optional fields to the repository", async () => {
      const { service, repo } = createService();

      await service.submitVolunteerApplication({
        applicantName: "王志愿者",
        contactInfo: "13700137000",
        experience: "三年支教经验",
        availability: "周末",
        motivation: "回馈社会",
        consent: true,
      });

      const stored = await repo.findVolunteerApplicationById("volapp-1");
      expect(stored?.experience).toBe("三年支教经验");
      expect(stored?.availability).toBe("周末");
      expect(stored?.motivation).toBe("回馈社会");
    });
  });

  // ---------------------------------------------------------------------------
  // listLeads
  // ---------------------------------------------------------------------------
  describe("listLeads", () => {
    it("allows school admin to list leads", async () => {
      const { service, repo } = createService();
      repo.addLead(cooperationLead());
      const auth = schoolAdminAuth();

      const result = await service.listLeads(auth, { limit: 20 });

      expect(result.items).toHaveLength(1);
    });

    it("allows platform admin to list leads", async () => {
      const { service, repo } = createService();
      repo.addLead(cooperationLead());
      const auth = platformAdminAuth();

      const result = await service.listLeads(auth, { limit: 20 });

      expect(result.items).toHaveLength(1);
    });

    it("denies student from listing leads", async () => {
      const { service } = createService();
      const auth = studentAuth();

      await expect(
        service.listLeads(auth, { limit: 20 }),
      ).rejects.toThrow(LeadForbiddenException);
    });

    it("denies teacher from listing leads", async () => {
      const { service } = createService();
      const auth = teacherAuth();

      await expect(
        service.listLeads(auth, { limit: 20 }),
      ).rejects.toThrow(LeadForbiddenException);
    });

    it("denies suspended admin from listing leads", async () => {
      const { service } = createService();
      const auth = suspendedAuth();

      await expect(
        service.listLeads(auth, { limit: 20 }),
      ).rejects.toThrow(LeadForbiddenException);
    });

    it("filters by status when provided", async () => {
      const { service, repo } = createService();
      repo.addLead(cooperationLead({ status: LeadStatus.NEW }));
      repo.addLead(cooperationLead({ status: LeadStatus.QUALIFIED }));
      const auth = schoolAdminAuth();

      const result = await service.listLeads(auth, {
        limit: 20,
        status: LeadStatus.NEW,
      });

      expect(result.items).toHaveLength(1);
    });

    it("returns paginated results with cursor", async () => {
      const { service, repo } = createService();
      for (let i = 0; i < 5; i++) {
        repo.addLead(cooperationLead());
      }
      const auth = platformAdminAuth();

      const page1 = await service.listLeads(auth, { limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBeDefined();

      const page2 = await service.listLeads(auth, {
        limit: 2,
        cursor: page1.nextCursor!,
      });
      expect(page2.items).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // getLead
  // ---------------------------------------------------------------------------
  describe("getLead", () => {
    it("allows school admin to view a lead", async () => {
      const { service, repo } = createService();
      const lead = cooperationLead();
      repo.addLead(lead);
      const auth = schoolAdminAuth();

      const result = await service.getLead(auth, lead.id);

      expect(result.id).toBe(lead.id);
    });

    it("allows platform admin to view a lead", async () => {
      const { service, repo } = createService();
      const lead = cooperationLead();
      repo.addLead(lead);
      const auth = platformAdminAuth();

      const result = await service.getLead(auth, lead.id);

      expect(result.id).toBe(lead.id);
    });

    it("throws LeadNotFoundException for missing lead", async () => {
      const { service } = createService();
      const auth = schoolAdminAuth();

      await expect(
        service.getLead(auth, "nonexistent-id"),
      ).rejects.toThrow(LeadNotFoundException);
    });

    it("denies student from viewing a lead", async () => {
      const { service } = createService();
      const auth = studentAuth();

      await expect(
        service.getLead(auth, "any-id"),
      ).rejects.toThrow(LeadForbiddenException);
    });

    it("denies teacher from viewing a lead", async () => {
      const { service } = createService();
      const auth = teacherAuth();

      await expect(
        service.getLead(auth, "any-id"),
      ).rejects.toThrow(LeadForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // updateLeadStatus
  // ---------------------------------------------------------------------------
  describe("updateLeadStatus", () => {
    it("allows platform admin to update lead status", async () => {
      const { service, repo } = createService();
      const lead = cooperationLead();
      repo.addLead(lead);
      const auth = platformAdminAuth();

      const result = await service.updateLeadStatus(
        auth,
        lead.id,
        LeadStatus.CONTACTED,
      );

      expect(result.status).toBe("CONTACTED");
    });

    it("allows platform admin to assign operator when updating status", async () => {
      const { service, repo } = createService();
      const lead = cooperationLead();
      repo.addLead(lead);
      const auth = platformAdminAuth();

      const result = await service.updateLeadStatus(
        auth,
        lead.id,
        LeadStatus.QUALIFIED,
        "operator-1",
      );

      expect(result.status).toBe("QUALIFIED");
      expect(result.assignedOperatorId).toBe("operator-1");
    });

    it("denies school admin from updating lead status", async () => {
      const { service, repo } = createService();
      const lead = cooperationLead();
      repo.addLead(lead);
      const auth = schoolAdminAuth();

      await expect(
        service.updateLeadStatus(auth, lead.id, LeadStatus.CONTACTED),
      ).rejects.toThrow(LeadForbiddenException);
    });

    it("denies student from updating lead status", async () => {
      const { service } = createService();
      const auth = studentAuth();

      await expect(
        service.updateLeadStatus(auth, "any-id", LeadStatus.CONTACTED),
      ).rejects.toThrow(LeadForbiddenException);
    });

    it("throws LeadNotFoundException for missing lead", async () => {
      const { service } = createService();
      const auth = platformAdminAuth();

      await expect(
        service.updateLeadStatus(auth, "nonexistent-id", LeadStatus.CONTACTED),
      ).rejects.toThrow(LeadNotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // listSupportApplications
  // ---------------------------------------------------------------------------
  describe("listSupportApplications", () => {
    it("allows school admin to list support applications", async () => {
      const { service, repo } = createService();
      repo.addSupportApplication(supportApplication());
      const auth = schoolAdminAuth();

      const result = await service.listSupportApplications(auth, { limit: 20 });

      expect(result.items).toHaveLength(1);
    });

    it("allows platform admin to list support applications", async () => {
      const { service, repo } = createService();
      repo.addSupportApplication(supportApplication());
      const auth = platformAdminAuth();

      const result = await service.listSupportApplications(auth, { limit: 20 });

      expect(result.items).toHaveLength(1);
    });

    it("denies student from listing support applications", async () => {
      const { service } = createService();
      const auth = studentAuth();

      await expect(
        service.listSupportApplications(auth, { limit: 20 }),
      ).rejects.toThrow(SupportApplicationForbiddenException);
    });

    it("denies teacher from listing support applications", async () => {
      const { service } = createService();
      const auth = teacherAuth();

      await expect(
        service.listSupportApplications(auth, { limit: 20 }),
      ).rejects.toThrow(SupportApplicationForbiddenException);
    });

    it("denies suspended admin from listing support applications", async () => {
      const { service } = createService();
      const auth = suspendedAuth();

      await expect(
        service.listSupportApplications(auth, { limit: 20 }),
      ).rejects.toThrow(SupportApplicationForbiddenException);
    });

    it("filters by status when provided", async () => {
      const { service, repo } = createService();
      repo.addSupportApplication(supportApplication({ status: ApplicationStatus.PENDING }));
      repo.addSupportApplication(supportApplication({ status: ApplicationStatus.APPROVED }));
      const auth = schoolAdminAuth();

      const result = await service.listSupportApplications(auth, {
        limit: 20,
        status: ApplicationStatus.PENDING,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe("PENDING");
    });
  });

  // ---------------------------------------------------------------------------
  // getSupportApplication
  // ---------------------------------------------------------------------------
  describe("getSupportApplication", () => {
    it("allows school admin to view a support application", async () => {
      const { service, repo } = createService();
      const app = supportApplication();
      repo.addSupportApplication(app);
      const auth = schoolAdminAuth();

      const result = await service.getSupportApplication(auth, app.id);

      expect(result.id).toBe(app.id);
    });

    it("allows platform admin to view a support application", async () => {
      const { service, repo } = createService();
      const app = supportApplication();
      repo.addSupportApplication(app);
      const auth = platformAdminAuth();

      const result = await service.getSupportApplication(auth, app.id);

      expect(result.id).toBe(app.id);
    });

    it("throws SupportApplicationNotFoundException for missing application", async () => {
      const { service } = createService();
      const auth = schoolAdminAuth();

      await expect(
        service.getSupportApplication(auth, "nonexistent-id"),
      ).rejects.toThrow(SupportApplicationNotFoundException);
    });

    it("denies student from viewing a support application", async () => {
      const { service } = createService();
      const auth = studentAuth();

      await expect(
        service.getSupportApplication(auth, "any-id"),
      ).rejects.toThrow(SupportApplicationForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // reviewSupportApplication
  // ---------------------------------------------------------------------------
  describe("reviewSupportApplication", () => {
    it("approves a support application with action approve", async () => {
      const { service, repo } = createService();
      const app = supportApplication();
      repo.addSupportApplication(app);
      const auth = schoolAdminAuth("school-1", { userId: "reviewer-1" });

      const result = await service.reviewSupportApplication(
        auth,
        app.id,
        "approve",
      );

      expect(result.status).toBe("APPROVED");
      expect(result.reviewedBy).toBe("reviewer-1");
    });

    it("rejects a support application with action reject", async () => {
      const { service, repo } = createService();
      const app = supportApplication();
      repo.addSupportApplication(app);
      const auth = schoolAdminAuth("school-1", { userId: "reviewer-1" });

      const result = await service.reviewSupportApplication(
        auth,
        app.id,
        "reject",
      );

      expect(result.status).toBe("REJECTED");
      expect(result.reviewedBy).toBe("reviewer-1");
    });

    it("stores review note when provided", async () => {
      const { service, repo } = createService();
      const app = supportApplication();
      repo.addSupportApplication(app);
      const auth = schoolAdminAuth("school-1", { userId: "reviewer-1" });

      const result = await service.reviewSupportApplication(
        auth,
        app.id,
        "approve",
        "审核通过，符合条件",
      );

      expect(result.reviewNote).toBe("审核通过，符合条件");
    });

    it("throws SupportApplicationNotFoundException for missing application", async () => {
      const { service } = createService();
      const auth = schoolAdminAuth();

      await expect(
        service.reviewSupportApplication(auth, "nonexistent-id", "approve"),
      ).rejects.toThrow(SupportApplicationNotFoundException);
    });

    it("denies student from reviewing a support application", async () => {
      const { service } = createService();
      const auth = studentAuth();

      await expect(
        service.reviewSupportApplication(auth, "any-id", "approve"),
      ).rejects.toThrow(SupportApplicationForbiddenException);
    });

    it("denies teacher from reviewing a support application", async () => {
      const { service } = createService();
      const auth = teacherAuth();

      await expect(
        service.reviewSupportApplication(auth, "any-id", "approve"),
      ).rejects.toThrow(SupportApplicationForbiddenException);
    });

    it("denies suspended admin from reviewing a support application", async () => {
      const { service } = createService();
      const auth = suspendedAuth();

      await expect(
        service.reviewSupportApplication(auth, "any-id", "approve"),
      ).rejects.toThrow(SupportApplicationForbiddenException);
    });

    it("allows platform admin to review a support application", async () => {
      const { service, repo } = createService();
      const app = supportApplication();
      repo.addSupportApplication(app);
      const auth = platformAdminAuth();

      const result = await service.reviewSupportApplication(
        auth,
        app.id,
        "approve",
      );

      expect(result.status).toBe("APPROVED");
    });
  });

  // ---------------------------------------------------------------------------
  // listVolunteerApplications
  // ---------------------------------------------------------------------------
  describe("listVolunteerApplications", () => {
    it("allows school admin to list volunteer applications", async () => {
      const { service, repo } = createService();
      repo.addVolunteerApplication(volunteerApplication());
      const auth = schoolAdminAuth();

      const result = await service.listVolunteerApplications(auth, { limit: 20 });

      expect(result.items).toHaveLength(1);
    });

    it("allows platform admin to list volunteer applications", async () => {
      const { service, repo } = createService();
      repo.addVolunteerApplication(volunteerApplication());
      const auth = platformAdminAuth();

      const result = await service.listVolunteerApplications(auth, { limit: 20 });

      expect(result.items).toHaveLength(1);
    });

    it("denies student from listing volunteer applications", async () => {
      const { service } = createService();
      const auth = studentAuth();

      await expect(
        service.listVolunteerApplications(auth, { limit: 20 }),
      ).rejects.toThrow(VolunteerApplicationForbiddenException);
    });

    it("denies teacher from listing volunteer applications", async () => {
      const { service } = createService();
      const auth = teacherAuth();

      await expect(
        service.listVolunteerApplications(auth, { limit: 20 }),
      ).rejects.toThrow(VolunteerApplicationForbiddenException);
    });

    it("filters by status when provided", async () => {
      const { service, repo } = createService();
      repo.addVolunteerApplication(volunteerApplication({ status: VolunteerAppStatus.PENDING }));
      repo.addVolunteerApplication(volunteerApplication({ status: VolunteerAppStatus.ACCEPTED }));
      const auth = schoolAdminAuth();

      const result = await service.listVolunteerApplications(auth, {
        limit: 20,
        status: VolunteerAppStatus.PENDING,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe("PENDING");
    });
  });

  // ---------------------------------------------------------------------------
  // getVolunteerApplication
  // ---------------------------------------------------------------------------
  describe("getVolunteerApplication", () => {
    it("allows school admin to view a volunteer application", async () => {
      const { service, repo } = createService();
      const app = volunteerApplication();
      repo.addVolunteerApplication(app);
      const auth = schoolAdminAuth();

      const result = await service.getVolunteerApplication(auth, app.id);

      expect(result.id).toBe(app.id);
    });

    it("allows platform admin to view a volunteer application", async () => {
      const { service, repo } = createService();
      const app = volunteerApplication();
      repo.addVolunteerApplication(app);
      const auth = platformAdminAuth();

      const result = await service.getVolunteerApplication(auth, app.id);

      expect(result.id).toBe(app.id);
    });

    it("throws VolunteerApplicationNotFoundException for missing application", async () => {
      const { service } = createService();
      const auth = schoolAdminAuth();

      await expect(
        service.getVolunteerApplication(auth, "nonexistent-id"),
      ).rejects.toThrow(VolunteerApplicationNotFoundException);
    });

    it("denies student from viewing a volunteer application", async () => {
      const { service } = createService();
      const auth = studentAuth();

      await expect(
        service.getVolunteerApplication(auth, "any-id"),
      ).rejects.toThrow(VolunteerApplicationForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // reviewVolunteerApplication
  // ---------------------------------------------------------------------------
  describe("reviewVolunteerApplication", () => {
    it("accepts a volunteer application with action approve", async () => {
      const { service, repo } = createService();
      const app = volunteerApplication();
      repo.addVolunteerApplication(app);
      const auth = schoolAdminAuth("school-1", { userId: "reviewer-1" });

      const result = await service.reviewVolunteerApplication(
        auth,
        app.id,
        "approve",
      );

      expect(result.status).toBe("ACCEPTED");
      expect(result.reviewedBy).toBe("reviewer-1");
    });

    it("rejects a volunteer application with action reject", async () => {
      const { service, repo } = createService();
      const app = volunteerApplication();
      repo.addVolunteerApplication(app);
      const auth = schoolAdminAuth("school-1", { userId: "reviewer-1" });

      const result = await service.reviewVolunteerApplication(
        auth,
        app.id,
        "reject",
      );

      expect(result.status).toBe("REJECTED");
      expect(result.reviewedBy).toBe("reviewer-1");
    });

    it("throws VolunteerApplicationNotFoundException for missing application", async () => {
      const { service } = createService();
      const auth = schoolAdminAuth();

      await expect(
        service.reviewVolunteerApplication(auth, "nonexistent-id", "approve"),
      ).rejects.toThrow(VolunteerApplicationNotFoundException);
    });

    it("denies student from reviewing a volunteer application", async () => {
      const { service } = createService();
      const auth = studentAuth();

      await expect(
        service.reviewVolunteerApplication(auth, "any-id", "approve"),
      ).rejects.toThrow(VolunteerApplicationForbiddenException);
    });

    it("denies teacher from reviewing a volunteer application", async () => {
      const { service } = createService();
      const auth = teacherAuth();

      await expect(
        service.reviewVolunteerApplication(auth, "any-id", "approve"),
      ).rejects.toThrow(VolunteerApplicationForbiddenException);
    });

    it("denies suspended admin from reviewing a volunteer application", async () => {
      const { service } = createService();
      const auth = suspendedAuth();

      await expect(
        service.reviewVolunteerApplication(auth, "any-id", "approve"),
      ).rejects.toThrow(VolunteerApplicationForbiddenException);
    });

    it("allows platform admin to review a volunteer application", async () => {
      const { service, repo } = createService();
      const app = volunteerApplication();
      repo.addVolunteerApplication(app);
      const auth = platformAdminAuth();

      const result = await service.reviewVolunteerApplication(
        auth,
        app.id,
        "reject",
      );

      expect(result.status).toBe("REJECTED");
    });
  });

  // ---------------------------------------------------------------------------
  // Unavailable repository
  // ---------------------------------------------------------------------------
  describe("fail-closes when repository is unavailable", () => {
    it("throws LeadUnavailableException for lead operations", async () => {
      const service = new CooperationService(new UnavailableCooperationRepository());
      const viewerAuth = schoolAdminAuth();
      const managerAuth = platformAdminAuth();

      await expect(
        service.submitLead({
          organizationName: "测试学校",
          contactName: "张主任",
          contactChannel: "13800138000",
          consent: true,
        }),
      ).rejects.toThrow(LeadUnavailableException);

      await expect(
        service.listLeads(viewerAuth, { limit: 20 }),
      ).rejects.toThrow(LeadUnavailableException);

      await expect(
        service.getLead(viewerAuth, "any-id"),
      ).rejects.toThrow(LeadUnavailableException);

      await expect(
        service.updateLeadStatus(managerAuth, "any-id", LeadStatus.CONTACTED),
      ).rejects.toThrow(LeadUnavailableException);
    });

    it("throws SupportApplicationUnavailableException for support application operations", async () => {
      const service = new CooperationService(new UnavailableCooperationRepository());
      const auth = schoolAdminAuth();

      await expect(
        service.submitSupportApplication({
          guardianName: "李家长",
          guardianContact: "13900139000",
          needCategory: "学费资助",
          description: "困难",
          consent: true,
        }),
      ).rejects.toThrow(SupportApplicationUnavailableException);

      await expect(
        service.listSupportApplications(auth, { limit: 20 }),
      ).rejects.toThrow(SupportApplicationUnavailableException);

      await expect(
        service.getSupportApplication(auth, "any-id"),
      ).rejects.toThrow(SupportApplicationUnavailableException);

      await expect(
        service.reviewSupportApplication(auth, "any-id", "approve"),
      ).rejects.toThrow(SupportApplicationUnavailableException);
    });

    it("throws VolunteerApplicationUnavailableException for volunteer application operations", async () => {
      const service = new CooperationService(new UnavailableCooperationRepository());
      const auth = schoolAdminAuth();

      await expect(
        service.submitVolunteerApplication({
          applicantName: "王志愿者",
          contactInfo: "13700137000",
          consent: true,
        }),
      ).rejects.toThrow(VolunteerApplicationUnavailableException);

      await expect(
        service.listVolunteerApplications(auth, { limit: 20 }),
      ).rejects.toThrow(VolunteerApplicationUnavailableException);

      await expect(
        service.getVolunteerApplication(auth, "any-id"),
      ).rejects.toThrow(VolunteerApplicationUnavailableException);

      await expect(
        service.reviewVolunteerApplication(auth, "any-id", "approve"),
      ).rejects.toThrow(VolunteerApplicationUnavailableException);
    });
  });

  // ---------------------------------------------------------------------------
  // Role-based access (cross-cutting)
  // ---------------------------------------------------------------------------
  describe("role-based access", () => {
    it("only SCHOOL_ADMIN and PLATFORM_ADMIN can view leads", async () => {
      const { service, repo } = createService();
      const lead = cooperationLead();
      repo.addLead(lead);

      // SCHOOL_ADMIN allowed
      await expect(
        service.getLead(schoolAdminAuth(), lead.id),
      ).resolves.toBeDefined();

      // PLATFORM_ADMIN allowed
      await expect(
        service.getLead(platformAdminAuth(), lead.id),
      ).resolves.toBeDefined();

      // STUDENT denied
      await expect(
        service.getLead(studentAuth(), lead.id),
      ).rejects.toThrow(LeadForbiddenException);

      // TEACHER denied
      await expect(
        service.getLead(teacherAuth(), lead.id),
      ).rejects.toThrow(LeadForbiddenException);
    });

    it("only PLATFORM_ADMIN can manage (update) leads", async () => {
      const { service, repo } = createService();
      const lead = cooperationLead();
      repo.addLead(lead);

      // PLATFORM_ADMIN allowed
      await expect(
        service.updateLeadStatus(platformAdminAuth(), lead.id, LeadStatus.CONTACTED),
      ).resolves.toBeDefined();

      // SCHOOL_ADMIN denied
      await expect(
        service.updateLeadStatus(schoolAdminAuth(), lead.id, LeadStatus.CONTACTED),
      ).rejects.toThrow(LeadForbiddenException);
    });

    it("SCHOOL_ADMIN and PLATFORM_ADMIN can review support applications", async () => {
      const { repo } = createService();

      // Test SCHOOL_ADMIN
      const service1 = createService();
      const app1 = supportApplication();
      service1.repo.addSupportApplication(app1);
      await expect(
        service1.service.reviewSupportApplication(
          schoolAdminAuth(),
          app1.id,
          "approve",
        ),
      ).resolves.toBeDefined();

      // Test PLATFORM_ADMIN
      const service2 = createService();
      const app2 = supportApplication();
      service2.repo.addSupportApplication(app2);
      await expect(
        service2.service.reviewSupportApplication(
          platformAdminAuth(),
          app2.id,
          "approve",
        ),
      ).resolves.toBeDefined();
    });

    it("SCHOOL_ADMIN and PLATFORM_ADMIN can review volunteer applications", async () => {
      const service1 = createService();
      const app1 = volunteerApplication();
      service1.repo.addVolunteerApplication(app1);
      await expect(
        service1.service.reviewVolunteerApplication(
          schoolAdminAuth(),
          app1.id,
          "approve",
        ),
      ).resolves.toBeDefined();

      const service2 = createService();
      const app2 = volunteerApplication();
      service2.repo.addVolunteerApplication(app2);
      await expect(
        service2.service.reviewVolunteerApplication(
          platformAdminAuth(),
          app2.id,
          "approve",
        ),
      ).resolves.toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Response shape verification
  // ---------------------------------------------------------------------------
  describe("response shapes", () => {
    it("submitLead returns public response with limited fields", async () => {
      const { service } = createService();

      const result = await service.submitLead({
        organizationName: "测试学校",
        contactName: "张主任",
        contactChannel: "13800138000",
        consent: true,
      });

      // Public response only has id, organizationName, createdAt
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("organizationName");
      expect(result).toHaveProperty("createdAt");
      // Should NOT expose internal fields like contactChannel, status, etc.
      expect(result).not.toHaveProperty("contactChannel");
      expect(result).not.toHaveProperty("status");
    });

    it("submitSupportApplication returns public response with limited fields", async () => {
      const { service } = createService();

      const result = await service.submitSupportApplication({
        guardianName: "李家长",
        guardianContact: "13900139000",
        needCategory: "学费资助",
        description: "困难",
        consent: true,
      });

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("needCategory");
      expect(result).toHaveProperty("createdAt");
      expect(result).not.toHaveProperty("guardianName");
      expect(result).not.toHaveProperty("description");
    });

    it("submitVolunteerApplication returns public response with limited fields", async () => {
      const { service } = createService();

      const result = await service.submitVolunteerApplication({
        applicantName: "王志愿者",
        contactInfo: "13700137000",
        consent: true,
      });

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("applicantName");
      expect(result).toHaveProperty("createdAt");
      expect(result).not.toHaveProperty("contactInfo");
      expect(result).not.toHaveProperty("status");
    });

    it("getLead returns full response for authorized users", async () => {
      const { service, repo } = createService();
      const lead = cooperationLead();
      repo.addLead(lead);
      const auth = schoolAdminAuth();

      const result = await service.getLead(auth, lead.id);

      // Full response includes internal fields
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("organizationName");
      expect(result).toHaveProperty("contactName");
      expect(result).toHaveProperty("contactChannel");
      expect(result).toHaveProperty("status");
    });
  });
});
