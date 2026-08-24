import { beforeEach, describe, expect, it, vi } from "vitest";

const redisState = vi.hoisted(() => ({ value: String(Date.now()) }));
vi.mock("ioredis", () => ({
  default: class FakeRedis {
    async get() { return redisState.value; }
    disconnect() {}
  },
}));

import { PilotObservabilityService } from "../../../src/modules/pilot/pilot-observability.service.js";
import { MembershipRole, MembershipStatus, createAuthContext } from "../../../src/common/security/index.js";

const schoolId = "00000000-0000-0000-0000-000000000001";
const admin = createAuthContext("request", {
  userId: "00000000-0000-0000-0000-000000000010",
  roles: [MembershipRole.SCHOOL_ADMIN],
  membershipStatus: MembershipStatus.ACTIVE,
  source: "test",
}, { schoolId });

function config() {
  return { get: (key: string, fallback?: unknown) => ({ WORKER_HEARTBEAT_TTL_SECONDS: 60, REDIS_HOST: "127.0.0.1", REDIS_PORT: 6379, SPEECH_PROVIDER: "disabled" }[key] ?? fallback) };
}

function fakePrisma() {
  const old = new Date(Date.now() - 45 * 60_000);
  const reviewOld = new Date(Date.now() - 26 * 60 * 60_000);
  return {
    assessmentSession: {
      groupBy: vi.fn(async ({ by }: { by: string[] }) => by.includes("remediationOrigin")
        ? [
          { remediationOrigin: "SELF_INITIATED", status: "COMPLETED", _count: { _all: 1 } },
          { remediationOrigin: "TEACHER_ASSIGNED", status: "PROCESSING", _count: { _all: 1 } },
        ]
        : [
          { status: "IN_PROGRESS", _count: { _all: 1 } },
          { status: "SUBMITTED", _count: { _all: 1 } },
          { status: "PROCESSING", _count: { _all: 1 } },
          { status: "COMPLETED", _count: { _all: 2 } },
        ]),
      count: vi.fn().mockResolvedValue(1),
      findFirst: vi.fn().mockResolvedValue({ updatedAt: old }),
    },
    assessmentItem: {
      findMany: vi.fn().mockResolvedValue([
        { createdAt: reviewOld, questionVersion: { scoringSpec: { strategy: "SPEECH_READING" } }, session: { submittedAt: reviewOld, enrollment: { userId: "student-1" } } },
        { createdAt: reviewOld, questionVersion: { scoringSpec: { strategy: "EXACT_CHOICE" } }, session: { submittedAt: reviewOld, enrollment: { userId: "student-1" } } },
      ]),
    },
    speechJob: { groupBy: vi.fn().mockResolvedValue([{ status: "NEEDS_REVIEW", _count: { _all: 1 } }, { status: "FAILED", _count: { _all: 1 } }]) },
    recording: { groupBy: vi.fn().mockResolvedValue([{ status: "READY", _count: { _all: 1 } }, { status: "FAILED", _count: { _all: 1 } }]) },
    pilotFeedback: { count: vi.fn().mockResolvedValue(1) },
  };
}

describe("PilotObservabilityService", () => {
  beforeEach(() => { redisState.value = String(Date.now()); });

  it("keeps formal and remediation funnels separate and exposes deterministic warnings", async () => {
    const prisma = fakePrisma();
    const health = { coreReadiness: vi.fn().mockResolvedValue({ database: "UP", redis: "UP", objectStorage: "UP" }) };
    const service = new PilotObservabilityService(prisma as never, health as never, config() as never);

    const result = await service.overview(admin, schoolId, "24h");

    expect(result.formalSessions).toMatchObject({ started: 5, submitted: 1, processing: 1, completed: 2, completionRate: 0.4 });
    expect(result.standardSessions).toMatchObject({ created: 5, inProgress: 1, completed: 2 });
    expect(result.remediation.selfInitiated).toMatchObject({ created: 1, completed: 1, processing: 0, completionRate: 1 });
    expect(result.remediation.teacherAssigned).toMatchObject({ created: 1, completed: 0, processing: 1, completionRate: 0 });
    expect(result.processingBacklog.staleProcessingCount).toBe(1);
    expect(result.teacherReviewBacklog).toMatchObject({ pendingReviewItems: 1, pendingReviewStudents: 1 });
    expect(result.speech.jobs).toEqual({ NEEDS_REVIEW: 1, FAILED: 1 });
    expect(result.warnings).toEqual(expect.arrayContaining(["STALE_PROCESSING", "REVIEW_BACKLOG", "SPEECH_JOB_FAILURES", "OPEN_FEEDBACK_BACKLOG"]));
    expect(result.overallState).toBe("ATTENTION");
    expect(JSON.stringify(result)).not.toMatch(/studentRank|topStudent|lowestStudent|percentile/);
  });

  it("marks the pilot DEGRADED when a core dependency is down", async () => {
    const prisma = fakePrisma();
    const health = { coreReadiness: vi.fn().mockResolvedValue({ database: "DOWN", redis: "UP", objectStorage: "UP" }) };
    const service = new PilotObservabilityService(prisma as never, health as never, config() as never);

    const result = await service.overview(admin, schoolId, "7d");

    expect(result.window).toBe("7d");
    expect(result.overallState).toBe("DEGRADED");
    expect(result.warnings).toContain("CORE_DEPENDENCY_DOWN");
  });
});
