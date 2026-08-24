import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@yuzan/database";
import { Redis } from "ioredis";
import { PilotFeedbackService } from "../../src/modules/pilot/pilot-feedback.service.js";
import { PilotObservabilityService } from "../../src/modules/pilot/pilot-observability.service.js";
import { MembershipRole, MembershipStatus, type AuthContext } from "../../src/common/security/index.js";

const databaseUrl = process.env.QB_RUNTIME_DATABASE_URL;

function auth(userId: string, schoolId: string, role: MembershipRole): AuthContext {
  return {
    requestId: randomUUID(),
    tenant: { schoolId },
    principal: { userId, roles: [role], membershipStatus: MembershipStatus.ACTIVE, source: "session" },
  };
}

describe.skipIf(!databaseUrl)("QB-016 pilot PostgreSQL integration", () => {
  let pool: Pool;
  let prisma: PrismaClient;
  let redis: Redis;
  let createdSessionIds: string[] = [];
  let createdFeedbackIds: string[] = [];
  let createdSpeechJobIds: string[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    redis = new Redis(process.env.REDIS_URL ?? `redis://${process.env.REDIS_HOST ?? "127.0.0.1"}:${process.env.REDIS_PORT ?? "6379"}`);
  });

  afterAll(async () => {
    if (createdFeedbackIds.length) await prisma.pilotFeedback.deleteMany({ where: { id: { in: createdFeedbackIds } } });
    if (createdSpeechJobIds.length) await prisma.speechJob.deleteMany({ where: { id: { in: createdSpeechJobIds } } });
    if (createdSessionIds.length) await prisma.assessmentSession.deleteMany({ where: { id: { in: createdSessionIds } } });
    await redis?.quit();
    await prisma?.$disconnect();
    await pool?.end();
  });

  it("aggregates real STANDARD/REMEDIATION rows and closes the feedback loop", async () => {
    const school = await prisma.school.findFirstOrThrow({ where: { isActive: true }, select: { id: true } });
    const studentEnrollment = await prisma.enrollment.findFirstOrThrow({ where: { schoolId: school.id, role: "STUDENT", status: "ACTIVE" }, select: { id: true, userId: true, classId: true } });
    const adminMembership = await prisma.membership.findFirstOrThrow({ where: { schoolId: school.id, role: "SCHOOL_ADMIN", status: "ACTIVE" }, select: { userId: true } });
    const version = (await prisma.questionBankItemVersion.findMany({ where: { status: "PUBLISHED" }, take: 100, include: { item: true } })).find((row) => {
      const strategy = (row.scoringSpec as Record<string, unknown>).strategy;
      return strategy === "SPEECH_READING" || strategy === "SPEECH_OPEN_RESPONSE" || strategy === "RUBRIC_TEXT";
    }) ?? await prisma.questionBankItemVersion.findFirstOrThrow({ where: { status: "PUBLISHED" }, include: { item: true } });

    const health = { coreReadiness: async () => ({ database: "UP" as const, redis: "UP" as const, objectStorage: "UP" as const }) };
    const config = { get: (key: string, fallback?: unknown) => ({ REDIS_URL: process.env.REDIS_URL, REDIS_HOST: process.env.REDIS_HOST ?? "127.0.0.1", REDIS_PORT: Number(process.env.REDIS_PORT ?? 6379), WORKER_HEARTBEAT_TTL_SECONDS: 60, SPEECH_PROVIDER: "disabled" }[key] ?? fallback) };
    const overviewService = new PilotObservabilityService(prisma as never, health as never, config as never);
    const feedbackService = new PilotFeedbackService(prisma as never);
    const before = await overviewService.overview(auth(adminMembership.userId, school.id, MembershipRole.SCHOOL_ADMIN), school.id, "24h");
    const now = new Date();

    const sessions = await Promise.all([
      prisma.assessmentSession.create({ data: { schoolId: school.id, enrollmentId: studentEnrollment.id, classId: studentEnrollment.classId, initiatorUserId: studentEnrollment.userId, type: "MIXED", purpose: "STANDARD", status: "COMPLETED", completedAt: now } }),
      prisma.assessmentSession.create({ data: { schoolId: school.id, enrollmentId: studentEnrollment.id, classId: studentEnrollment.classId, initiatorUserId: studentEnrollment.userId, type: "MIXED", purpose: "STANDARD", status: "PROCESSING" } }),
      prisma.assessmentSession.create({ data: { schoolId: school.id, enrollmentId: studentEnrollment.id, classId: studentEnrollment.classId, initiatorUserId: studentEnrollment.userId, type: "MIXED", purpose: "REMEDIATION", remediationOrigin: "SELF_INITIATED", status: "COMPLETED", completedAt: now } }),
      prisma.assessmentSession.create({ data: { schoolId: school.id, enrollmentId: studentEnrollment.id, classId: studentEnrollment.classId, initiatorUserId: studentEnrollment.userId, type: "MIXED", purpose: "REMEDIATION", remediationOrigin: "TEACHER_ASSIGNED", status: "PROCESSING" } }),
    ]);
    createdSessionIds = sessions.map((row) => row.id);
    await prisma.assessmentItem.createMany({ data: sessions.map((session) => ({ sessionId: session.id, questionVersionId: version.id, prompt: version.deliverySpec, itemType: version.item.itemType, sortOrder: 1, maxScore: 1, scoredScore: session.purpose === "STANDARD" && session.status === "COMPLETED" ? 1 : null })) });
    const speechJob = await prisma.speechJob.create({ data: { schoolId: school.id, status: "FAILED", provider: "local" } });
    createdSpeechJobIds.push(speechJob.id);
    const feedback = await feedbackService.create(auth(studentEnrollment.userId, school.id, MembershipRole.STUDENT), school.id, { category: "TECHNICAL", message: "试点运行集成测试反馈" });
    createdFeedbackIds.push(feedback.feedbackId);
    await feedbackService.updateStatus(auth(adminMembership.userId, school.id, MembershipRole.SCHOOL_ADMIN), school.id, feedback.feedbackId, { status: "RESOLVED", resolutionNote: "集成测试已处理" });

    const after = await overviewService.overview(auth(adminMembership.userId, school.id, MembershipRole.SCHOOL_ADMIN), school.id, "24h");
    expect(after.standardSessions.created - before.standardSessions.created).toBe(2);
    expect(after.standardSessions.completed - before.standardSessions.completed).toBe(1);
    expect(after.remediation.selfInitiated.created - before.remediation.selfInitiated.created).toBe(1);
    expect(after.remediation.teacherAssigned.processing - before.remediation.teacherAssigned.processing).toBe(1);
    expect((after.speech.jobs.FAILED ?? 0) - (before.speech.jobs.FAILED ?? 0)).toBe(1);
    expect(after.warnings).toContain("SPEECH_JOB_FAILURES");
    const mine = (await feedbackService.mine(auth(studentEnrollment.userId, school.id, MembershipRole.STUDENT), school.id)).items;
    expect(mine.find((entry) => entry.message === "试点运行集成测试反馈")).toMatchObject({ status: "RESOLVED", resolutionNote: "集成测试已处理" });
  });
});
