import { beforeEach, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import { DashboardService } from "../../src/modules/admin/dashboard/dashboard.service.js";
import { AdminModule } from "../../src/modules/admin/admin.module.js";
import { ADMIN_METRICS_PORT } from "../../src/modules/admin/ports/admin-metrics.port.js";
import { FakeAdminMetricsPort } from "./fakes/fake-admin-metrics.port.js";
import {
  platformAdminAuth,
  schoolAdminAuth,
  teacherAuth,
} from "../fixtures/auth.js";
import { AdminForbiddenException } from "../../src/modules/admin/domain/admin.errors.js";

describe("DashboardService", () => {
  let service: DashboardService;
  let metricsPort: FakeAdminMetricsPort;
  const schoolId = "school-a";

  beforeEach(async () => {
    metricsPort = new FakeAdminMetricsPort();

    const moduleRef = await Test.createTestingModule({
      imports: [AdminModule],
    })
      .overrideProvider(ADMIN_METRICS_PORT)
      .useValue(metricsPort)
      .compile();

    service = moduleRef.get(DashboardService);
  });

  describe("getPlatformMetrics", () => {
    it("returns aggregated metrics for platform admin", async () => {
      const auth = platformAdminAuth(schoolId);
      const result = await service.getPlatformMetrics(auth);

      expect(result.schoolCount).toBe(10);
      expect(result.activeUserCount).toBe(500);
      expect(result.publishedCourseCount).toBe(80);
      expect(result.pendingReviewCount).toBe(5);
      expect(result.assessmentTaskCount).toBe(200);
      expect(result.learningCompletionRate).toBe(0.72);
      expect(result.systemErrorCount).toBe(2);
      expect(result.providerStatuses).toHaveLength(1);
    });

    it("rejects school admin", async () => {
      const auth = schoolAdminAuth(schoolId);
      await expect(service.getPlatformMetrics(auth)).rejects.toThrow(
        AdminForbiddenException,
      );
    });

    it("rejects teacher", async () => {
      const auth = teacherAuth(schoolId);
      await expect(service.getPlatformMetrics(auth)).rejects.toThrow(
        AdminForbiddenException,
      );
    });
  });

  describe("fail-closed with unavailable repositories", () => {
    it("throws when metrics port is unavailable", async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [AdminModule],
      }).compile();
      const svc = moduleRef.get(DashboardService);
      const auth = platformAdminAuth(schoolId);

      await expect(svc.getPlatformMetrics(auth)).rejects.toThrow();
    });
  });
});
