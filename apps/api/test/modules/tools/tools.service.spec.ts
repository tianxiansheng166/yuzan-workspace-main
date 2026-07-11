import { describe, expect, it } from "vitest";
import {
  IntegrationForbiddenException,
  IntegrationNotFoundException,
  IntegrationUnavailableException,
  MindGraphJobNotFoundException,
  MindGraphProviderUnavailableException,
} from "../../../src/modules/tools/domain/tool.errors.js";
import {
  IntegrationKey,
  IntegrationMode,
  IntegrationStatus,
  MindGraphJobStatus,
} from "../../../src/modules/tools/domain/tool.types.js";
import { UnavailableToolRepository } from "../../../src/modules/tools/ports/unavailable-tool.repository.js";
import { ToolsService } from "../../../src/modules/tools/tools.service.js";
import { FakeToolRepository } from "./fakes/fake-tool.repository.js";
import { integrationConfig, mindGraphJob } from "./fixtures/tools.js";
import {
  studentAuth,
  teacherAuth,
  schoolAdminAuth,
  platformAdminAuth,
} from "./fixtures/users.js";

function createService(repo?: FakeToolRepository) {
  const r = repo ?? new FakeToolRepository();
  return { service: new ToolsService(r), repo: r };
}

const schoolId = "school-1";

describe("ToolsService", () => {
  // ---- listIntegrations ----

  describe("listIntegrations", () => {
    it("allows SCHOOL_ADMIN to list integrations", async () => {
      const { service, repo } = createService();
      repo.addConfig(
        integrationConfig({ schoolId, key: IntegrationKey.MINDGRAPH }),
      );
      repo.addConfig(
        integrationConfig({ schoolId, key: IntegrationKey.MINDMATE }),
      );
      const auth = schoolAdminAuth(schoolId);

      const result = await service.listIntegrations(auth, schoolId);

      expect(result).toHaveLength(2);
      expect(result[0]?.key).toBe(IntegrationKey.MINDGRAPH);
      expect(result[1]?.key).toBe(IntegrationKey.MINDMATE);
    });

    it("allows STUDENT to list integrations (view permission)", async () => {
      const { service, repo } = createService();
      repo.addConfig(
        integrationConfig({ schoolId, key: IntegrationKey.MINDGRAPH }),
      );
      const auth = studentAuth(schoolId);

      const result = await service.listIntegrations(auth, schoolId);

      expect(result).toHaveLength(1);
    });

    it("denies cross-tenant listing", async () => {
      const { service } = createService();
      const auth = schoolAdminAuth("school-1");

      await expect(
        service.listIntegrations(auth, "school-2"),
      ).rejects.toThrow(IntegrationForbiddenException);
    });
  });

  // ---- getIntegration ----

  describe("getIntegration", () => {
    it("returns a single integration by key", async () => {
      const { service, repo } = createService();
      repo.addConfig(
        integrationConfig({ schoolId, key: IntegrationKey.MINDGRAPH }),
      );
      const auth = schoolAdminAuth(schoolId);

      const result = await service.getIntegration(
        auth,
        schoolId,
        IntegrationKey.MINDGRAPH,
      );

      expect(result.key).toBe(IntegrationKey.MINDGRAPH);
    });

    it("throws IntegrationNotFoundException for missing key", async () => {
      const { service } = createService();
      const auth = schoolAdminAuth(schoolId);

      await expect(
        service.getIntegration(auth, schoolId, IntegrationKey.MINDGRAPH),
      ).rejects.toThrow(IntegrationNotFoundException);
    });

    it("denies cross-tenant access", async () => {
      const { service, repo } = createService();
      repo.addConfig(
        integrationConfig({ schoolId, key: IntegrationKey.MINDGRAPH }),
      );
      const auth = schoolAdminAuth("other-school");

      await expect(
        service.getIntegration(auth, schoolId, IntegrationKey.MINDGRAPH),
      ).rejects.toThrow(IntegrationForbiddenException);
    });
  });

  // ---- updateIntegration ----

  describe("updateIntegration", () => {
    it("allows SCHOOL_ADMIN to update integration", async () => {
      const { service, repo } = createService();
      repo.addConfig(
        integrationConfig({ schoolId, key: IntegrationKey.MINDGRAPH }),
      );
      const auth = schoolAdminAuth(schoolId);

      const result = await service.updateIntegration(
        auth,
        schoolId,
        IntegrationKey.MINDGRAPH,
        { enabled: false, mode: IntegrationMode.DISABLED },
      );

      expect(result.enabled).toBe(false);
      expect(result.mode).toBe(IntegrationMode.DISABLED);
    });

    it("denies STUDENT from updating integration", async () => {
      const { service, repo } = createService();
      repo.addConfig(
        integrationConfig({ schoolId, key: IntegrationKey.MINDGRAPH }),
      );
      const auth = studentAuth(schoolId);

      await expect(
        service.updateIntegration(auth, schoolId, IntegrationKey.MINDGRAPH, {
          enabled: false,
        }),
      ).rejects.toThrow(IntegrationForbiddenException);
    });

    it("throws IntegrationNotFoundException for missing config", async () => {
      const { service } = createService();
      const auth = schoolAdminAuth(schoolId);

      await expect(
        service.updateIntegration(
          auth,
          schoolId,
          IntegrationKey.MINDGRAPH,
          { enabled: true },
        ),
      ).rejects.toThrow(IntegrationNotFoundException);
    });

    it("updates publicUrl when provided", async () => {
      const { service, repo } = createService();
      repo.addConfig(
        integrationConfig({ schoolId, key: IntegrationKey.MINDGRAPH }),
      );
      const auth = schoolAdminAuth(schoolId);

      const result = await service.updateIntegration(
        auth,
        schoolId,
        IntegrationKey.MINDGRAPH,
        { publicUrl: "https://example.com/app" },
      );

      expect(result.publicUrl).toBe("https://example.com/app");
    });
  });

  // ---- createMindGraphJob ----

  describe("createMindGraphJob", () => {
    it("creates a job when config is OPERATIONAL", async () => {
      const { service, repo } = createService();
      repo.addConfig(
        integrationConfig({
          schoolId,
          key: IntegrationKey.MINDGRAPH,
          status: IntegrationStatus.OPERATIONAL,
        }),
      );
      const auth = teacherAuth(schoolId);

      const result = await service.createMindGraphJob(auth, schoolId, {
        prompt: "test",
      });

      expect(result.status).toBe(MindGraphJobStatus.CREATED);
      expect(result.inputPayload).toEqual({ prompt: "test" });
    });

    it("throws MindGraphProviderUnavailableException when status is PROVIDER_UNAVAILABLE", async () => {
      const { service, repo } = createService();
      repo.addConfig(
        integrationConfig({
          schoolId,
          key: IntegrationKey.MINDGRAPH,
          status: IntegrationStatus.PROVIDER_UNAVAILABLE,
        }),
      );
      const auth = teacherAuth(schoolId);

      await expect(
        service.createMindGraphJob(auth, schoolId),
      ).rejects.toThrow(MindGraphProviderUnavailableException);
    });

    it("throws MindGraphProviderUnavailableException when status is OFFLINE", async () => {
      const { service, repo } = createService();
      repo.addConfig(
        integrationConfig({
          schoolId,
          key: IntegrationKey.MINDGRAPH,
          status: IntegrationStatus.OFFLINE,
        }),
      );
      const auth = teacherAuth(schoolId);

      await expect(
        service.createMindGraphJob(auth, schoolId),
      ).rejects.toThrow(MindGraphProviderUnavailableException);
    });

    it("throws MindGraphProviderUnavailableException when config is disabled", async () => {
      const { service, repo } = createService();
      repo.addConfig(
        integrationConfig({
          schoolId,
          key: IntegrationKey.MINDGRAPH,
          enabled: false,
          status: IntegrationStatus.OPERATIONAL,
        }),
      );
      const auth = teacherAuth(schoolId);

      await expect(
        service.createMindGraphJob(auth, schoolId),
      ).rejects.toThrow(MindGraphProviderUnavailableException);
    });

    it("throws MindGraphProviderUnavailableException when config does not exist", async () => {
      const { service } = createService();
      const auth = teacherAuth(schoolId);

      await expect(
        service.createMindGraphJob(auth, schoolId),
      ).rejects.toThrow(MindGraphProviderUnavailableException);
    });

    it("never fakes AI results - resultPayload is always null on creation", async () => {
      const { service, repo } = createService();
      repo.addConfig(
        integrationConfig({
          schoolId,
          key: IntegrationKey.MINDGRAPH,
          status: IntegrationStatus.OPERATIONAL,
        }),
      );
      const auth = teacherAuth(schoolId);

      const result = await service.createMindGraphJob(auth, schoolId);

      expect(result.resultPayload).toBeNull();
    });

    it("denies STUDENT from creating MindGraph jobs", async () => {
      const { service, repo } = createService();
      repo.addConfig(
        integrationConfig({
          schoolId,
          key: IntegrationKey.MINDGRAPH,
          status: IntegrationStatus.OPERATIONAL,
        }),
      );
      const auth = studentAuth(schoolId);

      await expect(
        service.createMindGraphJob(auth, schoolId),
      ).rejects.toThrow(IntegrationForbiddenException);
    });

    it("allows SCHOOL_ADMIN to create MindGraph jobs", async () => {
      const { service, repo } = createService();
      repo.addConfig(
        integrationConfig({
          schoolId,
          key: IntegrationKey.MINDGRAPH,
          status: IntegrationStatus.OPERATIONAL,
        }),
      );
      const auth = schoolAdminAuth(schoolId);

      const result = await service.createMindGraphJob(auth, schoolId);

      expect(result.status).toBe(MindGraphJobStatus.CREATED);
    });

    it("denies cross-tenant job creation", async () => {
      const { service, repo } = createService();
      repo.addConfig(
        integrationConfig({
          schoolId: "school-1",
          key: IntegrationKey.MINDGRAPH,
          status: IntegrationStatus.OPERATIONAL,
        }),
      );
      const auth = teacherAuth("school-2");

      await expect(
        service.createMindGraphJob(auth, "school-1"),
      ).rejects.toThrow(IntegrationForbiddenException);
    });
  });

  // ---- getJobStatus ----

  describe("getJobStatus", () => {
    it("returns real job status without fabrication", async () => {
      const { service, repo } = createService();
      const config = integrationConfig({
        schoolId,
        key: IntegrationKey.MINDGRAPH,
      });
      repo.addConfig(config);
      const job = mindGraphJob({
        schoolId,
        configId: config.id,
        status: MindGraphJobStatus.QUEUED,
      });
      repo.addJob(job);
      const auth = teacherAuth(schoolId);

      const result = await service.getJobStatus(auth, schoolId, job.id);

      expect(result.id).toBe(job.id);
      expect(result.status).toBe(MindGraphJobStatus.QUEUED);
      // Verify no fabricated data - resultPayload must be exactly what the job has
      expect(result.resultPayload).toBeNull();
    });

    it("returns PROVIDER_UNAVAILABLE status truthfully without fabricating success", async () => {
      const { service, repo } = createService();
      const config = integrationConfig({
        schoolId,
        key: IntegrationKey.MINDGRAPH,
      });
      repo.addConfig(config);
      const job = mindGraphJob({
        schoolId,
        configId: config.id,
        status: MindGraphJobStatus.PROVIDER_UNAVAILABLE,
      });
      repo.addJob(job);
      const auth = teacherAuth(schoolId);

      const result = await service.getJobStatus(auth, schoolId, job.id);

      expect(result.status).toBe(MindGraphJobStatus.PROVIDER_UNAVAILABLE);
      expect(result.resultPayload).toBeNull();
    });

    it("throws MindGraphJobNotFoundException for missing job", async () => {
      const { service } = createService();
      const auth = teacherAuth(schoolId);

      await expect(
        service.getJobStatus(auth, schoolId, "nonexistent-job"),
      ).rejects.toThrow(MindGraphJobNotFoundException);
    });

    it("throws MindGraphJobNotFoundException for cross-tenant job", async () => {
      const { service, repo } = createService();
      const job = mindGraphJob({
        schoolId: "school-2",
        configId: "cfg-x",
        status: MindGraphJobStatus.READY,
      });
      repo.addJob(job);
      const auth = teacherAuth("school-1");

      await expect(
        service.getJobStatus(auth, "school-1", job.id),
      ).rejects.toThrow(MindGraphJobNotFoundException);
    });

    it("denies STUDENT from viewing job status for another school", async () => {
      const { service, repo } = createService();
      const config = integrationConfig({
        schoolId: "school-2",
        key: IntegrationKey.MINDGRAPH,
      });
      repo.addConfig(config);
      const job = mindGraphJob({
        schoolId: "school-2",
        configId: config.id,
        status: MindGraphJobStatus.READY,
      });
      repo.addJob(job);
      // Student from school-1 tries to access a school-2 job
      // First the job lookup will succeed (repo returns it) but schoolId won't match
      const auth = studentAuth("school-1");

      // schoolId mismatch => MindGraphJobNotFoundException
      await expect(
        service.getJobStatus(auth, "school-1", job.id),
      ).rejects.toThrow(MindGraphJobNotFoundException);
    });

    it("returns real resultPayload without fabrication when job has results", async () => {
      const { service, repo } = createService();
      const config = integrationConfig({
        schoolId,
        key: IntegrationKey.MINDGRAPH,
      });
      repo.addConfig(config);
      const realResult = { graph: { nodes: 3, edges: 2 } };
      const job = mindGraphJob({
        schoolId,
        configId: config.id,
        status: MindGraphJobStatus.READY,
        resultPayload: realResult,
      });
      repo.addJob(job);
      const auth = teacherAuth(schoolId);

      const result = await service.getJobStatus(auth, schoolId, job.id);

      expect(result.resultPayload).toEqual(realResult);
    });
  });

  // ---- listMyJobs ----

  describe("listMyJobs", () => {
    it("lists jobs for the user's school", async () => {
      const { service, repo } = createService();
      const config = integrationConfig({
        schoolId,
        key: IntegrationKey.MINDGRAPH,
      });
      repo.addConfig(config);
      repo.addJob(
        mindGraphJob({ schoolId, configId: config.id, status: MindGraphJobStatus.CREATED }),
      );
      repo.addJob(
        mindGraphJob({ schoolId, configId: config.id, status: MindGraphJobStatus.QUEUED }),
      );
      const auth = teacherAuth(schoolId);

      const result = await service.listMyJobs(auth, schoolId, { limit: 20 });

      expect(result.items).toHaveLength(2);
    });

    it("returns empty list when no MINDGRAPH config exists", async () => {
      const { service } = createService();
      const auth = teacherAuth(schoolId);

      const result = await service.listMyJobs(auth, schoolId, { limit: 20 });

      expect(result.items).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it("allows STUDENT to list their own jobs (view permission)", async () => {
      const { service } = createService();
      const auth = studentAuth(schoolId);

      const result = await service.listMyJobs(auth, schoolId, { limit: 20 });

      expect(result.items).toHaveLength(0);
    });

    it("filters by status when provided", async () => {
      const { service, repo } = createService();
      const config = integrationConfig({
        schoolId,
        key: IntegrationKey.MINDGRAPH,
      });
      repo.addConfig(config);
      repo.addJob(
        mindGraphJob({ schoolId, configId: config.id, status: MindGraphJobStatus.CREATED }),
      );
      repo.addJob(
        mindGraphJob({ schoolId, configId: config.id, status: MindGraphJobStatus.READY }),
      );
      const auth = teacherAuth(schoolId);

      const result = await service.listMyJobs(auth, schoolId, {
        limit: 20,
        status: MindGraphJobStatus.READY,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.status).toBe(MindGraphJobStatus.READY);
    });
  });

  // ---- auditClick ----

  describe("auditClick", () => {
    it("records a click audit entry", async () => {
      const { service } = createService();
      const auth = teacherAuth(schoolId);

      const result = await service.auditClick(
        auth,
        schoolId,
        IntegrationKey.MINDMATE,
        "navigate",
        "https://example.com/mindmate",
      );

      expect(result.schoolId).toBe(schoolId);
      expect(result.integrationKey).toBe(IntegrationKey.MINDMATE);
      expect(result.userId).toBe(auth.principal.userId);
      expect(result.action).toBe("navigate");
      expect(result.targetUrl).toBe("https://example.com/mindmate");
    });

    it("records click without targetUrl", async () => {
      const { service } = createService();
      const auth = schoolAdminAuth(schoolId);

      const result = await service.auditClick(
        auth,
        schoolId,
        IntegrationKey.TIBETAN_TRANSLATION,
        "open",
      );

      expect(result.targetUrl).toBeNull();
      expect(result.integrationKey).toBe(IntegrationKey.TIBETAN_TRANSLATION);
    });

    it("denies STUDENT from recording click audits", async () => {
      const { service } = createService();
      const auth = studentAuth("other-school");

      await expect(
        service.auditClick(auth, schoolId, IntegrationKey.MINDMATE, "click"),
      ).rejects.toThrow(IntegrationForbiddenException);
    });

    it("denies cross-tenant click audit", async () => {
      const { service } = createService();
      const auth = teacherAuth("school-1");

      await expect(
        service.auditClick(auth, "school-2", IntegrationKey.MINDMATE, "click"),
      ).rejects.toThrow(IntegrationForbiddenException);
    });
  });

  // ---- UnavailableToolRepository ----

  describe("fail-closes when repository is unavailable", () => {
    it("throws IntegrationUnavailableException for listConfigs", async () => {
      const service = new ToolsService(new UnavailableToolRepository());
      const auth = schoolAdminAuth(schoolId);

      await expect(
        service.listIntegrations(auth, schoolId),
      ).rejects.toThrow(IntegrationUnavailableException);
    });

    it("throws IntegrationUnavailableException for getIntegration", async () => {
      const service = new ToolsService(new UnavailableToolRepository());
      const auth = schoolAdminAuth(schoolId);

      await expect(
        service.getIntegration(auth, schoolId, IntegrationKey.MINDGRAPH),
      ).rejects.toThrow(IntegrationUnavailableException);
    });

    it("throws IntegrationUnavailableException for updateIntegration", async () => {
      const service = new ToolsService(new UnavailableToolRepository());
      const auth = schoolAdminAuth(schoolId);

      await expect(
        service.updateIntegration(auth, schoolId, IntegrationKey.MINDGRAPH, {
          enabled: true,
        }),
      ).rejects.toThrow(IntegrationUnavailableException);
    });

    it("throws IntegrationUnavailableException for createMindGraphJob", async () => {
      const service = new ToolsService(new UnavailableToolRepository());
      const auth = teacherAuth(schoolId);

      await expect(
        service.createMindGraphJob(auth, schoolId),
      ).rejects.toThrow(IntegrationUnavailableException);
    });

    it("throws IntegrationUnavailableException for getJobStatus", async () => {
      const service = new ToolsService(new UnavailableToolRepository());
      const auth = teacherAuth(schoolId);

      await expect(
        service.getJobStatus(auth, schoolId, "any-job"),
      ).rejects.toThrow(IntegrationUnavailableException);
    });

    it("throws IntegrationUnavailableException for listMyJobs", async () => {
      const service = new ToolsService(new UnavailableToolRepository());
      const auth = teacherAuth(schoolId);

      await expect(
        service.listMyJobs(auth, schoolId, { limit: 20 }),
      ).rejects.toThrow(IntegrationUnavailableException);
    });

    it("throws IntegrationUnavailableException for auditClick", async () => {
      const service = new ToolsService(new UnavailableToolRepository());
      const auth = teacherAuth(schoolId);

      await expect(
        service.auditClick(auth, schoolId, IntegrationKey.MINDMATE, "click"),
      ).rejects.toThrow(IntegrationUnavailableException);
    });
  });

  // ---- Cross-tenant denial ----

  describe("cross-tenant access", () => {
    it("denies listing integrations for a different school", async () => {
      const { service } = createService();
      const auth = schoolAdminAuth("school-1");

      await expect(
        service.listIntegrations(auth, "school-2"),
      ).rejects.toThrow(IntegrationForbiddenException);
    });

    it("denies updating integration for a different school", async () => {
      const { service } = createService();
      const auth = schoolAdminAuth("school-1");

      await expect(
        service.updateIntegration(auth, "school-2", IntegrationKey.MINDGRAPH, {
          enabled: false,
        }),
      ).rejects.toThrow(IntegrationForbiddenException);
    });

    it("denies creating MindGraph job for a different school", async () => {
      const { service } = createService();
      const auth = teacherAuth("school-1");

      await expect(
        service.createMindGraphJob(auth, "school-2"),
      ).rejects.toThrow(IntegrationForbiddenException);
    });

    it("denies listing jobs for a different school", async () => {
      const { service } = createService();
      const auth = teacherAuth("school-1");

      await expect(
        service.listMyJobs(auth, "school-2", { limit: 20 }),
      ).rejects.toThrow(IntegrationForbiddenException);
    });

    it("denies audit click for a different school", async () => {
      const { service } = createService();
      const auth = teacherAuth("school-1");

      await expect(
        service.auditClick(auth, "school-2", IntegrationKey.MINDMATE, "click"),
      ).rejects.toThrow(IntegrationForbiddenException);
    });
  });

  // ---- Platform Admin cross-tenant ----

  describe("platform admin", () => {
    it("can list integrations for any school", async () => {
      const { service, repo } = createService();
      repo.addConfig(
        integrationConfig({ schoolId: "school-2", key: IntegrationKey.MINDGRAPH }),
      );
      const auth = platformAdminAuth("platform-school");

      const result = await service.listIntegrations(auth, "school-2");

      expect(result).toHaveLength(1);
    });

    it("denies PLATFORM_ADMIN from creating MindGraph job cross-tenant (requires TEACHER/SCHOOL_ADMIN role)", async () => {
      const { service, repo } = createService();
      repo.addConfig(
        integrationConfig({
          schoolId: "school-2",
          key: IntegrationKey.MINDGRAPH,
          status: IntegrationStatus.OPERATIONAL,
        }),
      );
      const auth = platformAdminAuth("platform-school");

      await expect(
        service.createMindGraphJob(auth, "school-2"),
      ).rejects.toThrow(IntegrationForbiddenException);
    });
  });
});
