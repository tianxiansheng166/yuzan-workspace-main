import { describe, expect, it } from "vitest";
import { createAuthContext } from "../../../src/common/security/auth-context.js";
import { MembershipRole } from "../../../src/common/security/index.js";
import {
  VolunteerForbiddenException,
  VolunteerInvalidTransitionException,
  VolunteerNotFoundException,
  VolunteerNotQualifiedException,
  ServiceTaskForbiddenException,
  ServiceTaskNotFoundException,
  IncidentReportForbiddenException,
} from "../../../src/modules/volunteers/domain/volunteer.errors.js";
import { VolunteerStatus } from "../../../src/modules/volunteers/domain/volunteer.types.js";
import { UnavailableVolunteerRepository } from "../../../src/modules/volunteers/ports/unavailable-volunteer.repository.js";
import { VolunteersService } from "../../../src/modules/volunteers/volunteers.service.js";
import { FakeVolunteerRepository } from "./fakes/fake-volunteer.repository.js";
import { volunteer, serviceTask } from "./fixtures/volunteers.js";
import {
  studentAuth,
  teacherAuth,
  volunteerAuth,
  schoolAdminAuth,
  platformAdminAuth,
} from "./fixtures/users.js";

function createService(repo?: FakeVolunteerRepository) {
  const r = repo ?? new FakeVolunteerRepository();
  return { service: new VolunteersService(r), repo: r };
}

const schoolId = "school-1";

describe("VolunteersService", () => {
  describe("apply", () => {
    it("creates a volunteer with APPLIED status", async () => {
      const { service } = createService();
      const auth = volunteerAuth(schoolId, { userId: "user-1" });

      const result = await service.apply(auth, schoolId, {
        userId: "user-1",
        displayName: "张三",
        phone: "13800138000",
      });

      expect(result.status).toBe("APPLIED");
      expect(result.displayName).toBe("张三");
    });

    it("denies cross-tenant apply", async () => {
      const { service } = createService();
      const auth = studentAuth("other-school", { userId: "user-1" });

      await expect(
        service.apply(auth, schoolId, {
          userId: "user-1",
          displayName: "张三",
          phone: "13800138000",
        }),
      ).rejects.toThrow(VolunteerForbiddenException);
    });
  });

  describe("listVolunteers", () => {
    it("allows teacher to list volunteers", async () => {
      const { service, repo } = createService();
      repo.addVolunteer(volunteer({ schoolId, userId: "user-1" }));
      const auth = teacherAuth(schoolId);

      const result = await service.listVolunteers(auth, schoolId, {
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
    });

    it("denies student listing volunteers", async () => {
      const { service } = createService();
      const auth = studentAuth(schoolId);

      await expect(
        service.listVolunteers(auth, schoolId, { limit: 20 }),
      ).rejects.toThrow(VolunteerForbiddenException);
    });
  });

  describe("getVolunteer", () => {
    it("allows teacher to view volunteer", async () => {
      const { service, repo } = createService();
      const v = volunteer({ schoolId, userId: "user-1" });
      repo.addVolunteer(v);
      const auth = teacherAuth(schoolId);

      const result = await service.getVolunteer(auth, schoolId, v.id);

      expect(result.id).toBe(v.id);
    });

    it("throws not found for missing volunteer", async () => {
      const { service } = createService();
      const auth = teacherAuth(schoolId);

      await expect(
        service.getVolunteer(auth, schoolId, "missing-id"),
      ).rejects.toThrow(VolunteerNotFoundException);
    });
  });

  describe("transitionStatus", () => {
    it("transitions APPLIED to SCREENING", async () => {
      const { service, repo } = createService();
      const v = volunteer({ schoolId, status: VolunteerStatus.APPLIED });
      repo.addVolunteer(v);
      const auth = schoolAdminAuth(schoolId);

      const result = await service.transitionStatus(
        auth,
        schoolId,
        v.id,
        VolunteerStatus.SCREENING,
        v.revision,
      );

      expect(result.status).toBe("SCREENING");
    });

    it("rejects invalid transition APPLIED to ACTIVE", async () => {
      const { service, repo } = createService();
      const v = volunteer({ schoolId, status: VolunteerStatus.APPLIED });
      repo.addVolunteer(v);
      const auth = schoolAdminAuth(schoolId);

      await expect(
        service.transitionStatus(
          auth,
          schoolId,
          v.id,
          VolunteerStatus.ACTIVE,
          v.revision,
        ),
      ).rejects.toThrow(VolunteerInvalidTransitionException);
    });

    it("transitions through full lifecycle", async () => {
      const { service, repo } = createService();
      const v = volunteer({ schoolId, status: VolunteerStatus.APPLIED });
      repo.addVolunteer(v);
      const auth = schoolAdminAuth(schoolId);

      const transitions: VolunteerStatus[] = [
        VolunteerStatus.SCREENING,
        VolunteerStatus.ACCEPTED,
        VolunteerStatus.TRAINING_REQUIRED,
        VolunteerStatus.TRAINING_IN_PROGRESS,
        VolunteerStatus.EXAM_READY,
        VolunteerStatus.QUALIFIED,
        VolunteerStatus.ACTIVE,
      ];

      let current = v;
      for (const nextStatus of transitions) {
        const result = await service.transitionStatus(
          auth,
          schoolId,
          current.id,
          nextStatus,
          current.revision,
        );
        expect(result.status).toBe(nextStatus);
        current = {
          ...current,
          status: nextStatus,
          revision: current.revision + 1,
        };
        repo.addVolunteer(current);
      }
    });

    it("denies student from transitioning status", async () => {
      const { service, repo } = createService();
      const v = volunteer({ schoolId, status: VolunteerStatus.APPLIED });
      repo.addVolunteer(v);
      const auth = studentAuth(schoolId);

      await expect(
        service.transitionStatus(
          auth,
          schoolId,
          v.id,
          VolunteerStatus.SCREENING,
          v.revision,
        ),
      ).rejects.toThrow(VolunteerForbiddenException);
    });

    it("records suspended reason when suspending", async () => {
      const { service, repo } = createService();
      const v = volunteer({ schoolId, status: VolunteerStatus.ACTIVE });
      repo.addVolunteer(v);
      const auth = schoolAdminAuth(schoolId);

      const result = await service.transitionStatus(
        auth,
        schoolId,
        v.id,
        VolunteerStatus.SUSPENDED,
        v.revision,
        { suspendedReason: "违反规定" },
      );

      expect(result.status).toBe("SUSPENDED");
      expect(result.suspendedReason).toBe("违反规定");
    });

    it("sets qualifiedAt when reaching QUALIFIED status", async () => {
      const { service, repo } = createService();
      const v = volunteer({ schoolId, status: VolunteerStatus.EXAM_READY });
      repo.addVolunteer(v);
      const auth = schoolAdminAuth(schoolId);

      const result = await service.transitionStatus(
        auth,
        schoolId,
        v.id,
        VolunteerStatus.QUALIFIED,
        v.revision,
      );

      expect(result.status).toBe("QUALIFIED");
      expect(result.qualifiedAt).toBeDefined();
    });
  });

  describe("service tasks", () => {
    it("allows teacher to list service tasks", async () => {
      const { service, repo } = createService();
      repo.addServiceTask(serviceTask({ schoolId }));
      const auth = teacherAuth(schoolId);

      const result = await service.listServiceTasks(auth, schoolId, {
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
    });

    it("allows qualified volunteer to see assigned tasks", async () => {
      const { service, repo } = createService();
      const v = volunteer({
        schoolId,
        userId: "user-1",
        status: VolunteerStatus.QUALIFIED,
      });
      repo.addVolunteer(v);
      const t = serviceTask({ schoolId, assignedVolunteerId: v.id });
      repo.addServiceTask(t);
      const auth = volunteerAuth(schoolId, { userId: "user-1" });

      const result = await service.listMyServiceTasks(auth, schoolId, 20);

      expect(result.items).toHaveLength(1);
    });

    it("denies unqualified volunteer from seeing tasks", async () => {
      const { service, repo } = createService();
      const v = volunteer({
        schoolId,
        userId: "user-1",
        status: VolunteerStatus.APPLIED,
      });
      repo.addVolunteer(v);
      const auth = volunteerAuth(schoolId, { userId: "user-1" });

      await expect(
        service.listMyServiceTasks(auth, schoolId, 20),
      ).rejects.toThrow(VolunteerNotQualifiedException);
    });

    it("assigns task to qualified volunteer", async () => {
      const { service, repo } = createService();
      const v = volunteer({ schoolId, status: VolunteerStatus.QUALIFIED });
      repo.addVolunteer(v);
      const t = serviceTask({ schoolId });
      repo.addServiceTask(t);
      const auth = teacherAuth(schoolId);

      const result = await service.assignServiceTask(
        auth,
        schoolId,
        t.id,
        v.id,
      );

      expect(result.assignedVolunteerId).toBe(v.id);
    });

    it("denies assigning task to unqualified volunteer", async () => {
      const { service, repo } = createService();
      const v = volunteer({ schoolId, status: VolunteerStatus.APPLIED });
      repo.addVolunteer(v);
      const t = serviceTask({ schoolId });
      repo.addServiceTask(t);
      const auth = teacherAuth(schoolId);

      await expect(
        service.assignServiceTask(auth, schoolId, t.id, v.id),
      ).rejects.toThrow(VolunteerNotQualifiedException);
    });
  });

  describe("incidents", () => {
    it("allows teacher to report incident", async () => {
      const { service } = createService();
      const auth = teacherAuth(schoolId);

      const result = await service.reportIncident(auth, schoolId, {
        type: "BEHAVIOR",
        severity: "HIGH",
        description: "学生情绪波动",
        reportedBy: auth.principal.userId,
      });

      expect(result.type).toBe("BEHAVIOR");
      expect(result.severity).toBe("HIGH");
    });

    it("denies student from reporting incidents", async () => {
      const { service } = createService();
      const auth = studentAuth(schoolId);

      await expect(
        service.reportIncident(auth, schoolId, {
          type: "BEHAVIOR",
          severity: "HIGH",
          description: "测试",
          reportedBy: auth.principal.userId,
        }),
      ).rejects.toThrow(IncidentReportForbiddenException);
    });

    it("allows teacher to list incidents", async () => {
      const { service, repo } = createService();
      const auth = teacherAuth(schoolId);
      await service.reportIncident(auth, schoolId, {
        type: "BEHAVIOR",
        severity: "HIGH",
        description: "测试",
        reportedBy: auth.principal.userId,
      });

      const result = await service.listIncidents(auth, schoolId, { limit: 20 });

      expect(result.items).toHaveLength(1);
    });
  });

  describe("fail-closes when repository is unavailable", () => {
    it("throws unavailable for all operations", async () => {
      const service = new VolunteersService(
        new UnavailableVolunteerRepository(),
      );
      const auth = teacherAuth(schoolId);

      await expect(
        service.listVolunteers(auth, schoolId, { limit: 20 }),
      ).rejects.toThrow();

      await expect(
        service.getVolunteer(auth, schoolId, "any-id"),
      ).rejects.toThrow();
    });
  });

  describe("cross-tenant access", () => {
    it("denies access to different school", async () => {
      const { service } = createService();
      const auth = teacherAuth("school-1");

      await expect(
        service.listVolunteers(auth, "school-2", { limit: 20 }),
      ).rejects.toThrow(VolunteerForbiddenException);
    });
  });
});
