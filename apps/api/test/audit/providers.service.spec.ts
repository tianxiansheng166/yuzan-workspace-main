import { beforeEach, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import { ProvidersService } from "../../src/modules/audit/providers/providers.service.js";
import { AuditModule } from "../../src/modules/audit/audit.module.js";
import { PROVIDER_REPOSITORY } from "../../src/modules/audit/ports/provider-repository.port.js";
import { PROVIDER_SECRET_REPOSITORY } from "../../src/modules/audit/ports/provider-secret-repository.port.js";
import { FakeProviderRepository } from "./fakes/fake-provider.repository.js";
import { FakeProviderSecretRepository } from "./fakes/fake-provider-secret.repository.js";
import {
  platformAdminAuth,
  schoolAdminAuth,
  teacherAuth,
  studentAuth,
} from "../fixtures/auth.js";
import {
  ProviderNotFoundException,
  ProviderConflictException,
} from "../../src/modules/audit/domain/provider.errors.js";
import { systemProvider } from "./fixtures/providers.js";

describe("ProvidersService", () => {
  let service: ProvidersService;
  let providerRepo: FakeProviderRepository;
  let secretRepo: FakeProviderSecretRepository;
  const schoolId = "school-a";

  beforeEach(async () => {
    providerRepo = new FakeProviderRepository();
    secretRepo = new FakeProviderSecretRepository();

    const moduleRef = await Test.createTestingModule({
      imports: [AuditModule],
    })
      .overrideProvider(PROVIDER_REPOSITORY)
      .useValue(providerRepo)
      .overrideProvider(PROVIDER_SECRET_REPOSITORY)
      .useValue(secretRepo)
      .compile();

    service = moduleRef.get(ProvidersService);
  });

  describe("listProviders", () => {
    it("returns all providers for platform admin", async () => {
      const auth = platformAdminAuth(schoolId);
      providerRepo.add(
        systemProvider({ id: "p1", type: "LLM" }),
        systemProvider({ id: "p2", type: "SPEECH" }),
      );

      const result = await service.listProviders(auth);
      expect(result).toHaveLength(2);
    });

    it("allows school_admin to view providers", async () => {
      const auth = schoolAdminAuth(schoolId);
      providerRepo.add(systemProvider({ id: "p1" }));

      const result = await service.listProviders(auth);
      expect(result).toHaveLength(1);
    });

    it("rejects teacher", async () => {
      const auth = teacherAuth(schoolId);
      await expect(
        service.listProviders(auth),
      ).rejects.toThrow(ProviderNotFoundException);
    });

    it("rejects student", async () => {
      const auth = studentAuth(schoolId);
      await expect(
        service.listProviders(auth),
      ).rejects.toThrow(ProviderNotFoundException);
    });
  });

  describe("findById", () => {
    it("returns provider for platform admin", async () => {
      const auth = platformAdminAuth(schoolId);
      providerRepo.add(systemProvider({ id: "p1", type: "LLM" }));

      const result = await service.findById(auth, "p1");
      expect(result.id).toBe("p1");
      expect(result.type).toBe("LLM");
    });

    it("allows school_admin to view provider", async () => {
      const auth = schoolAdminAuth(schoolId);
      providerRepo.add(systemProvider({ id: "p1" }));

      const result = await service.findById(auth, "p1");
      expect(result.id).toBe("p1");
    });

    it("throws ProviderNotFoundException when not found", async () => {
      const auth = platformAdminAuth(schoolId);
      await expect(
        service.findById(auth, "nonexistent"),
      ).rejects.toThrow(ProviderNotFoundException);
    });

    it("rejects teacher", async () => {
      const auth = teacherAuth(schoolId);
      providerRepo.add(systemProvider({ id: "p1" }));

      await expect(
        service.findById(auth, "p1"),
      ).rejects.toThrow(ProviderNotFoundException);
    });
  });

  describe("createProvider", () => {
    it("creates provider with defaults", async () => {
      const auth = platformAdminAuth(schoolId);
      const result = await service.createProvider(auth, "LLM", true);

      expect(result.type).toBe("LLM");
      expect(result.enabled).toBe(true);
      expect(result.healthStatus).toBe("UNKNOWN");
      expect(result.configured).toBe(false);
      expect(result.endpointAlias).toBeNull();
      expect(result.model).toBeNull();
    });

    it("creates provider with secret and marks configured", async () => {
      const auth = platformAdminAuth(schoolId);
      const result = await service.createProvider(
        auth, "LLM", true, undefined, undefined, "sk-test",
      );

      expect(result.configured).toBe(true);
    });

    it("creates provider with endpointAlias and model", async () => {
      const auth = platformAdminAuth(schoolId);
      const result = await service.createProvider(
        auth, "LLM", true, "my-endpoint", "gpt-4",
      );

      expect(result.endpointAlias).toBe("my-endpoint");
      expect(result.model).toBe("gpt-4");
    });

    it("rejects school_admin", async () => {
      const auth = schoolAdminAuth(schoolId);
      await expect(
        service.createProvider(auth, "LLM", true),
      ).rejects.toThrow(ProviderConflictException);
    });

    it("rejects teacher", async () => {
      const auth = teacherAuth(schoolId);
      await expect(
        service.createProvider(auth, "LLM", true),
      ).rejects.toThrow(ProviderConflictException);
    });
  });

  describe("updateProvider", () => {
    it("updates enabled field", async () => {
      const auth = platformAdminAuth(schoolId);
      const existing = systemProvider({ id: "p1", enabled: true });
      providerRepo.add(existing);

      const result = await service.updateProvider(auth, "p1", {
        enabled: false,
        expectedUpdatedAt: existing.updatedAt,
      });
      expect(result.enabled).toBe(false);
    });

    it("throws ProviderNotFoundException when not found", async () => {
      const auth = platformAdminAuth(schoolId);
      await expect(
        service.updateProvider(auth, "nonexistent", {
          enabled: false,
          expectedUpdatedAt: new Date(),
        }),
      ).rejects.toThrow(ProviderNotFoundException);
    });

    it("rejects school_admin", async () => {
      const auth = schoolAdminAuth(schoolId);
      providerRepo.add(systemProvider({ id: "p1" }));

      await expect(
        service.updateProvider(auth, "p1", {
          enabled: false,
          expectedUpdatedAt: new Date(),
        }),
      ).rejects.toThrow(ProviderConflictException);
    });
  });

  describe("checkHealth", () => {
    it("returns health status for platform admin", async () => {
      const auth = platformAdminAuth(schoolId);
      providerRepo.add(systemProvider({ id: "p1", healthStatus: "HEALTHY" }));

      const result = await service.checkHealth(auth, "p1");
      expect(result.healthStatus).toBe("HEALTHY");
      expect(result.lastCheckedAt).toBeInstanceOf(Date);
    });

    it("throws ProviderNotFoundException when not found", async () => {
      const auth = platformAdminAuth(schoolId);
      await expect(
        service.checkHealth(auth, "nonexistent"),
      ).rejects.toThrow(ProviderNotFoundException);
    });

    it("rejects school_admin", async () => {
      const auth = schoolAdminAuth(schoolId);
      providerRepo.add(systemProvider({ id: "p1" }));

      await expect(
        service.checkHealth(auth, "p1"),
      ).rejects.toThrow(ProviderConflictException);
    });
  });

  describe("fail-closed with unavailable repositories", () => {
    it("throws when provider repository is unavailable", async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [AuditModule],
      }).compile();
      const svc = moduleRef.get(ProvidersService);
      const auth = platformAdminAuth(schoolId);

      await expect(
        svc.listProviders(auth),
      ).rejects.toThrow(ProviderNotFoundException);
    });
  });
});
