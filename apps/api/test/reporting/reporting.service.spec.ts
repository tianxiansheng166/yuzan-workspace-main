import { describe, it, expect, beforeEach } from "vitest";
import { Test } from "@nestjs/testing";
import { ReportingService } from "../../src/modules/reporting/reporting.service.js";
import type { ReportRepositoryPort } from "../../src/modules/reporting/ports/report-repository.port.js";
import { REPORT_REPOSITORY } from "../../src/modules/reporting/ports/report-repository.port.js";
import type { LearningPlanRepositoryPort } from "../../src/modules/reporting/ports/learning-plan-repository.port.js";
import { LEARNING_PLAN_REPOSITORY } from "../../src/modules/reporting/ports/learning-plan-repository.port.js";
import type { Report } from "../../src/modules/reporting/domain/report.types.js";
import type { AuthContext } from "../../src/common/security/auth.types.js";
import { MembershipRole } from "../../src/common/security/membership-role.js";
import { MembershipStatus } from "../../src/common/security/auth.types.js";
import { createFakeDatabaseModule, createFakePrismaService } from "../helpers/fake-prisma.service.js";

function makeAuth(schoolId: string, role: MembershipRole = MembershipRole.TEACHER): AuthContext {
  return {
    requestId: "test-req-id",
    principal: {
      userId: "user-1",
      roles: [role],
      membershipStatus: MembershipStatus.ACTIVE,
      source: "test",
    },
    tenant: { schoolId },
  };
}

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: "report-1",
    schoolId: "school-1",
    type: "STUDENT_GROWTH",
    status: "READY",
    periodStart: new Date("2026-01-01"),
    periodEnd: new Date("2026-06-30"),
    filters: null,
    dataCompleteness: 0.85,
    providerDisclosure: "Test disclosure",
    generatedAt: new Date("2026-07-01"),
    generatedByUserId: "user-1",
    enrollmentId: "enrollment-1",
    classId: null,
    data: { averageScore: 85 },
    revision: 1,
    createdAt: new Date("2026-07-01"),
    updatedAt: new Date("2026-07-01"),
    ...overrides,
  };
}

class FakeReportRepository implements ReportRepositoryPort {
  private reports: Report[] = [];

  async list(schoolId: string) {
    return {
      items: this.reports.filter((r) => r.schoolId === schoolId),
      nextCursor: null,
      hasMore: false,
    };
  }

  async findById(schoolId: string, reportId: string) {
    return this.reports.find((r) => r.id === reportId && r.schoolId === schoolId) ?? null;
  }

  async create(params: Record<string, unknown>) {
    const report = makeReport({ schoolId: params.schoolId as string, type: params.type as Report["type"], status: "PENDING" });
    this.reports.push(report);
    return report;
  }

  async updateStatus() {
    return makeReport();
  }
}

class FakeLearningPlanRepository implements LearningPlanRepositoryPort {
  async findByEnrollmentId(): Promise<null> {
    return null;
  }
  async create(): Promise<never> {
    throw new Error("not implemented in fake");
  }
  async updateWithRevision(): Promise<null> {
    return null;
  }
}

describe("ReportingService", () => {
  let service: ReportingService;
  let repo: FakeReportRepository;

  beforeEach(async () => {
    repo = new FakeReportRepository();
    const module = await Test.createTestingModule({
      imports: [createFakeDatabaseModule(createFakePrismaService())],
      providers: [
        ReportingService,
        { provide: REPORT_REPOSITORY, useValue: repo },
        { provide: LEARNING_PLAN_REPOSITORY, useValue: new FakeLearningPlanRepository() },
      ],
    }).compile();
    service = module.get(ReportingService);
  });

  describe("listReports", () => {
    it("returns mapped reports for authorized user", async () => {
      const auth = makeAuth("school-1");
      await repo.create({ schoolId: "school-1", type: "STUDENT_GROWTH" });
      const result = await service.listReports(auth, "school-1", {});
      expect(result.items).toHaveLength(1);
    });

    it("throws FORBIDDEN when tenant schoolId does not match", async () => {
      const auth = makeAuth("school-2");
      await expect(service.listReports(auth, "school-1", {})).rejects.toThrow();
    });
  });

  describe("createReport", () => {
    it("creates report for authorized teacher", async () => {
      const auth = makeAuth("school-1", MembershipRole.TEACHER);
      const result = await service.createReport(auth, "school-1", {
        type: "STUDENT_GROWTH",
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-06-30"),
      });
      expect(result.type).toBe("STUDENT_GROWTH");
    });

    it("throws FORBIDDEN for student role", async () => {
      const auth = makeAuth("school-1", MembershipRole.STUDENT);
      await expect(service.createReport(auth, "school-1", {
        type: "STUDENT_GROWTH",
        periodStart: new Date(),
        periodEnd: new Date(),
      })).rejects.toThrow();
    });
  });

  describe("getReport", () => {
    it("returns report detail for authorized user", async () => {
      const auth = makeAuth("school-1");
      await repo.create({ schoolId: "school-1", type: "STUDENT_GROWTH" });
      const result = await service.getReport(auth, "school-1", "report-1");
      expect(result.id).toBe("report-1");
    });

    it("throws NOT_FOUND when report does not exist", async () => {
      const auth = makeAuth("school-1");
      await expect(service.getReport(auth, "school-1", "nonexistent")).rejects.toThrow();
    });
  });

  describe("tenant-negative tests", () => {
    it("rejects listReports from wrong school", async () => {
      const auth = makeAuth("school-2");
      await expect(service.listReports(auth, "school-1", {})).rejects.toThrow();
    });

    it("rejects createReport from wrong school", async () => {
      const auth = makeAuth("school-2", MembershipRole.TEACHER);
      await expect(service.createReport(auth, "school-1", {
        type: "STUDENT_GROWTH",
        periodStart: new Date(),
        periodEnd: new Date(),
      })).rejects.toThrow();
    });

    it("rejects getReport from wrong school", async () => {
      const auth = makeAuth("school-2");
      await repo.create({ schoolId: "school-1", type: "STUDENT_GROWTH" });
      await expect(service.getReport(auth, "school-1", "report-1")).rejects.toThrow();
    });
  });
});