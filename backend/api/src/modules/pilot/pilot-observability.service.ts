import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import type { AuthContext } from "../../common/security/auth.types.js";
import { MembershipRole } from "../../common/security/membership-role.js";
import { reviewableAssessmentStrategy } from "../assessment/assessment-review.service.js";
import { HealthService } from "../health/health.service.js";
import { PrismaService } from "../../shared/database/prisma.service.js";

type Window = "24h" | "7d";
const DEFAULT_WORKER_HEARTBEAT_KEY = "yuzan:worker:heartbeat";
const DEFAULT_WORKER_HEARTBEAT_TTL_SECONDS = 60;

function statusMap(rows: Array<{ status: string; _count: { _all: number } }>) {
  return Object.fromEntries(rows.map((row) => [row.status, row._count._all])) as Record<string, number>;
}

@Injectable()
export class PilotObservabilityService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(HealthService) private readonly health: HealthService,
    private readonly config: ConfigService,
  ) {}

  async overview(auth: AuthContext, schoolId: string, requestedWindow?: Window) {
    this.assertAdmin(auth, schoolId);
    const window = requestedWindow ?? "24h";
    const now = new Date();
    const since = new Date(now.getTime() - (window === "7d" ? 7 : 1) * 24 * 60 * 60 * 1000);
    const staleBefore = new Date(now.getTime() - 30 * 60 * 1000);
    const formalBase = { schoolId, purpose: "STANDARD" as const, items: { some: { questionVersionId: { not: null } } } };
    const remediationBase = { schoolId, purpose: "REMEDIATION" as const };

    const [core, worker, formalRows, remediationRows, staleProcessingCount, oldestProcessing, reviewRows, speechRows, recordingRows, openFeedbackCount] = await Promise.all([
      this.health.coreReadiness(),
      this.workerHeartbeat(),
      this.prisma.assessmentSession.groupBy({ by: ["status"], where: { ...formalBase, createdAt: { gte: since } }, _count: { _all: true } }),
      this.prisma.assessmentSession.groupBy({ by: ["remediationOrigin", "status"], where: { ...remediationBase, createdAt: { gte: since } }, _count: { _all: true } }),
      this.prisma.assessmentSession.count({ where: { schoolId, purpose: { in: ["STANDARD", "REMEDIATION"] }, status: "PROCESSING", updatedAt: { lt: staleBefore }, items: { some: { questionVersionId: { not: null } } } } }),
      this.prisma.assessmentSession.findFirst({ where: { schoolId, purpose: { in: ["STANDARD", "REMEDIATION"] }, status: "PROCESSING", items: { some: { questionVersionId: { not: null } } } }, orderBy: [{ updatedAt: "asc" }, { id: "asc" }], select: { updatedAt: true } }),
      this.prisma.assessmentItem.findMany({
        where: {
          questionVersionId: { not: null },
          scoredScore: null,
          session: { schoolId, status: { in: ["SUBMITTED", "PROCESSING"] } },
          questionVersion: { status: "PUBLISHED" },
        },
        select: {
          createdAt: true,
          questionVersion: { select: { scoringSpec: true } },
          session: { select: { submittedAt: true, enrollment: { select: { userId: true } } } },
        },
      }),
      this.prisma.speechJob.groupBy({ by: ["status"], where: { schoolId, createdAt: { gte: since } }, _count: { _all: true } }),
      this.prisma.recording.groupBy({ by: ["status"], where: { schoolId, createdAt: { gte: since } }, _count: { _all: true } }),
      this.prisma.pilotFeedback.count({ where: { schoolId, status: { in: ["OPEN", "ACKNOWLEDGED"] } } }),
    ]);

    const formal = statusMap(formalRows);
    const standardSessions = {
      created: formalRows.reduce((total, row) => total + row._count._all, 0),
      inProgress: formal.IN_PROGRESS ?? 0,
      submitted: formal.SUBMITTED ?? 0,
      processing: formal.PROCESSING ?? 0,
      completed: formal.COMPLETED ?? 0,
    };
    const started = standardSessions.created - (formal.CREATED ?? 0);
    const remediation = this.remediationMetrics(remediationRows);
    const reviewable = reviewRows.filter((row) => reviewableAssessmentStrategy(row.questionVersion?.scoringSpec));
    const oldestReviewDate = reviewable.reduce<Date | null>((oldest, row) => {
      const candidate = row.session.submittedAt ?? row.createdAt;
      return !oldest || candidate < oldest ? candidate : oldest;
    }, null);
    const oldestPendingAgeMinutes = oldestReviewDate ? Math.floor((now.getTime() - oldestReviewDate.getTime()) / 60_000) : null;
    const speech = statusMap(speechRows);
    const warnings: string[] = [];
    if (Object.values(core).some((state) => state === "DOWN")) warnings.push("CORE_DEPENDENCY_DOWN");
    if (worker !== "UP") warnings.push("WORKER_HEARTBEAT_STALE");
    if (staleProcessingCount > 0) warnings.push("STALE_PROCESSING");
    if ((oldestPendingAgeMinutes ?? 0) >= 24 * 60) warnings.push("REVIEW_BACKLOG");
    if ((speech.FAILED ?? 0) > 0) warnings.push("SPEECH_JOB_FAILURES");
    if (openFeedbackCount > 0) warnings.push("OPEN_FEEDBACK_BACKLOG");
    const overallState = Object.values(core).some((state) => state === "DOWN") ? "DEGRADED" : warnings.length ? "ATTENTION" : "HEALTHY";

    return {
      window,
      generatedAt: now.toISOString(),
      overallState,
      dependencies: {
        database: core.database, redis: core.redis, objectStorage: core.objectStorage, worker,
        speechDiagnostic: this.speechDiagnosticState(),
      },
      formalSessions: {
        started, submitted: standardSessions.submitted, processing: standardSessions.processing, completed: standardSessions.completed,
        completionRate: standardSessions.created === 0 ? null : Number((standardSessions.completed / standardSessions.created).toFixed(4)),
      },
      standardSessions,
      processingBacklog: {
        staleProcessingCount,
        oldestProcessingAgeMinutes: oldestProcessing ? Math.floor((now.getTime() - oldestProcessing.updatedAt.getTime()) / 60_000) : null,
      },
      teacherReviewBacklog: {
        pendingReviewItems: reviewable.length,
        pendingReviewStudents: new Set(reviewable.map((row) => row.session.enrollment.userId)).size,
        oldestPendingAgeMinutes,
      },
      remediation,
      speech: { jobs: speech, recordings: statusMap(recordingRows) },
      feedback: { openCount: openFeedbackCount },
      warnings,
    };
  }

  private remediationMetrics(rows: Array<{ remediationOrigin: string | null; status: string; _count: { _all: number } }>) {
    const byOrigin = (origin: "SELF_INITIATED" | "TEACHER_ASSIGNED") => {
      const matching = rows.filter((row) => (row.remediationOrigin ?? "SELF_INITIATED") === origin);
      const statuses = statusMap(matching);
      const created = matching.reduce((total, row) => total + row._count._all, 0);
      const completed = statuses.COMPLETED ?? 0;
      return { created, completed, processing: statuses.PROCESSING ?? 0, completionRate: created === 0 ? null : Number((completed / created).toFixed(4)) };
    };
    return { selfInitiated: byOrigin("SELF_INITIATED"), teacherAssigned: byOrigin("TEACHER_ASSIGNED") };
  }

  private async workerHeartbeat(): Promise<"UP" | "STALE" | "UNKNOWN"> {
    const url = this.config.get<string>("REDIS_URL");
    const redis = url ? new Redis(url, { lazyConnect: true, connectTimeout: 2_500, maxRetriesPerRequest: 0 }) : new Redis({
      host: this.config.get<string>("REDIS_HOST", "127.0.0.1"), port: Number(this.config.get<string | number>("REDIS_PORT", 6379)),
      ...(this.config.get<string>("REDIS_PASSWORD") ? { password: this.config.get<string>("REDIS_PASSWORD") } : {}), lazyConnect: true, connectTimeout: 2_500, maxRetriesPerRequest: 0,
    });
    try {
      const value = await redis.get(this.config.get<string>("WORKER_HEARTBEAT_KEY", DEFAULT_WORKER_HEARTBEAT_KEY));
      if (!value) return "UNKNOWN";
      const timestamp = Number(value);
      if (!Number.isFinite(timestamp)) return "STALE";
      const ttlSeconds = Number(this.config.get<string | number>("WORKER_HEARTBEAT_TTL_SECONDS", DEFAULT_WORKER_HEARTBEAT_TTL_SECONDS));
      return Date.now() - timestamp <= ttlSeconds * 1_000 ? "UP" : "STALE";
    } catch {
      return "UNKNOWN";
    } finally {
      redis.disconnect();
    }
  }

  private speechDiagnosticState(): "DISABLED" | "AVAILABLE" | "UNAVAILABLE" {
    const provider = (this.config.get<string>("SPEECH_PROVIDER", "disabled") ?? "disabled").trim().toLowerCase();
    if (provider === "disabled") return "DISABLED";
    return provider === "local" && Boolean(this.config.get<string>("SPEECH_API_URL")) ? "AVAILABLE" : "UNAVAILABLE";
  }

  private assertAdmin(auth: AuthContext, schoolId: string) {
    if (auth.tenant.schoolId !== schoolId || !auth.principal.roles.some((role) => role === MembershipRole.SCHOOL_ADMIN || role === MembershipRole.PLATFORM_ADMIN)) {
      throw new ForbiddenException({ code: "PILOT_ADMIN_REQUIRED", message: "仅学校管理员可查看试点运行数据" });
    }
  }
}
