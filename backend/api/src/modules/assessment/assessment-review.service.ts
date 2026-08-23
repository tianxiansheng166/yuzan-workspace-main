import { Inject, Injectable, Optional } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import { MembershipRole } from "../../common/security/index.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { STORAGE_PORT, type StoragePort } from "../../shared/storage/storage.port.js";
import {
  AssessmentConflictException,
  AssessmentForbiddenException,
  AssessmentItemNotFoundException,
  AssessmentValidationFailedException,
} from "./domain/assessment.errors.js";
import { AssessmentService } from "./assessment.service.js";

export const REVIEWABLE_ASSESSMENT_STRATEGIES = new Set([
  "RUBRIC_TEXT",
  "SPEECH_READING",
  "SPEECH_OPEN_RESPONSE",
]);

type ReviewableStrategy = "RUBRIC_TEXT" | "SPEECH_READING" | "SPEECH_OPEN_RESPONSE";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scoringSpec(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

/** Shared reviewability boundary for queues and teacher diagnostics. */
export function reviewableAssessmentStrategy(value: unknown): ReviewableStrategy | null {
  const strategy = scoringSpec(value).strategy;
  return typeof strategy === "string" && REVIEWABLE_ASSESSMENT_STRATEGIES.has(strategy)
    ? strategy as ReviewableStrategy
    : null;
}

function safeRubric(value: unknown) {
  const spec = scoringSpec(value);
  return {
    rubric: Array.isArray(spec.rubric) ? spec.rubric : null,
    referenceAnswer: typeof spec.referenceAnswer === "string" ? spec.referenceAnswer : null,
    deductionRules: Array.isArray(spec.deductionRules)
      ? spec.deductionRules.filter((entry): entry is string => typeof entry === "string")
      : [],
  };
}

function transcriptOf(value: unknown): string | null {
  return isRecord(value) && typeof value.transcript === "string"
    ? value.transcript
    : null;
}

@Injectable()
export class AssessmentReviewService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AssessmentService) private readonly assessmentService: AssessmentService,
    @Optional() @Inject(STORAGE_PORT) private readonly storage?: StoragePort,
  ) {}

  async listQueue(auth: AuthContext, schoolId: string) {
    await this.assertTeacherScope(auth, schoolId);
    const classIds = await this.reviewableClassIds(auth, schoolId);
    if (!this.isAdmin(auth) && classIds.length === 0) {
      return { items: [], total: 0 };
    }

    const rows = await this.prisma.assessmentItem.findMany({
      where: {
        questionVersionId: { not: null },
        scoredScore: null,
        session: {
          schoolId,
          status: { in: ["SUBMITTED", "PROCESSING"] },
          ...(!this.isAdmin(auth) ? { classId: { in: classIds } } : {}),
        },
        questionVersion: { status: "PUBLISHED" },
      },
      select: {
        id: true,
        sessionId: true,
        itemType: true,
        maxScore: true,
        status: true,
        sortOrder: true,
        session: {
          select: {
            status: true,
            classId: true,
            practiceDefinitionId: true,
            enrollment: { select: { user: { select: { displayName: true } } } },
          },
        },
        questionVersion: {
          select: {
            scoringSpec: true,
            item: { select: { domain: true, stableKey: true, itemType: true } },
          },
        },
      },
      orderBy: [{ session: { submittedAt: "asc" } }, { sortOrder: "asc" }],
    });
    const titleMap = await this.practiceTitles(schoolId, rows.map((row) => row.session.practiceDefinitionId));

    const items = rows.flatMap((row) => {
      const strategy = reviewableAssessmentStrategy(row.questionVersion?.scoringSpec);
      if (!strategy) return [];
      return [{
        itemId: row.id,
        sessionId: row.sessionId,
        student: { displayName: row.session.enrollment.user.displayName },
        practice: { title: titleMap.get(row.session.practiceDefinitionId ?? "") ?? "Level 1 综合诊断" },
        itemFamily: strategy,
        strategy,
        domain: row.questionVersion?.item.domain ?? null,
        maxScore: row.maxScore,
        state: row.status,
        sessionStatus: row.session.status,
        sortOrder: row.sortOrder,
      }];
    });
    return { items, total: items.length };
  }

  async getDetail(auth: AuthContext, schoolId: string, itemId: string) {
    await this.assertTeacherScope(auth, schoolId);
    const row = await this.prisma.assessmentItem.findFirst({
      where: { id: itemId, session: { schoolId } },
      select: {
        id: true,
        sessionId: true,
        prompt: true,
        itemType: true,
        maxScore: true,
        status: true,
        scoredScore: true,
        autoResult: true,
        reviewerUserId: true,
        reviewerComment: true,
        reviewedAt: true,
        recordingId: true,
        session: {
          select: {
            id: true,
            schoolId: true,
            classId: true,
            status: true,
            practiceDefinitionId: true,
            enrollment: { select: { user: { select: { displayName: true } } } },
          },
        },
        questionVersion: {
          select: {
            status: true,
            deliverySpec: true,
            scoringSpec: true,
            item: { select: { domain: true, stableKey: true, itemType: true } },
          },
        },
        writtenAnswer: { select: { content: true, wordCount: true, charCount: true, finalSubmittedAt: true } },
        recording: { select: { id: true, status: true, durationMs: true, mimeType: true, objectKey: true } },
        speechJobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true, result: true, errorCode: true, confidence: true, processingMs: true },
        },
      },
    });
    if (!row) throw new AssessmentItemNotFoundException();
    await this.assertReviewClass(auth, schoolId, row.session.classId);
    if (!row.questionVersion || row.questionVersion.status !== "PUBLISHED") {
      throw new AssessmentConflictException("复核题目没有可用的已发布题库版本");
    }
    const strategy = reviewableAssessmentStrategy(row.questionVersion.scoringSpec);
    if (!strategy) throw new AssessmentConflictException("该题型不允许人工复核");
    if (row.session.status === "COMPLETED" || row.session.status === "CANCELLED") {
      throw new AssessmentConflictException("当前测评已经结束，不能打开待复核题目");
    }
    const practiceTitle = row.session.practiceDefinitionId
      ? (await this.prisma.practiceDefinition.findFirst({ where: { id: row.session.practiceDefinitionId, OR: [{ schoolId }, { schoolId: null }] }, select: { title: true } }))?.title
      : undefined;

    const speechJob = row.speechJobs[0] ?? null;
    let playbackUrl: string | null = null;
    if (row.recording?.objectKey && this.storage) {
      const download = await this.storage.generateDownloadUrl(row.recording.objectKey);
      playbackUrl = download.url;
    }

    return {
      itemId: row.id,
      sessionId: row.sessionId,
      student: { displayName: row.session.enrollment.user.displayName },
      practice: { title: practiceTitle ?? "Level 1 综合诊断" },
      item: {
        itemType: row.itemType,
        itemFamily: strategy,
        strategy,
        domain: row.questionVersion.item.domain,
        maxScore: row.maxScore,
        state: row.status,
        scoredScore: row.scoredScore,
        reviewerUserId: row.reviewerUserId,
        reviewerComment: row.reviewerComment,
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        prompt: row.prompt,
        deliverySpec: row.questionVersion.deliverySpec,
        targetText: strategy === "SPEECH_READING"
          ? (typeof scoringSpec(row.questionVersion.scoringSpec).targetText === "string"
              ? scoringSpec(row.questionVersion.scoringSpec).targetText
              : null)
          : null,
        answer: row.writtenAnswer?.content ?? null,
      },
      review: safeRubric(row.questionVersion.scoringSpec),
      evidence: {
        recordingId: row.recording?.id ?? row.recordingId,
        playbackUrl,
        recordingStatus: row.recording?.status ?? null,
        durationMs: row.recording?.durationMs ?? null,
        mimeType: row.recording?.mimeType ?? null,
        speechJobId: speechJob?.id ?? null,
        speechJobStatus: speechJob?.status ?? null,
        transcript: transcriptOf(speechJob?.result),
        diagnostic: row.autoResult,
        providerConfidence: speechJob?.confidence ?? null,
        processingMs: speechJob?.processingMs ?? null,
        errorCode: speechJob?.errorCode ?? null,
      },
    };
  }

  async submit(
    auth: AuthContext,
    schoolId: string,
    itemId: string,
    data: { score: number; comment?: string },
  ) {
    const item = await this.prisma.assessmentItem.findFirst({
      where: { id: itemId, session: { schoolId } },
      select: { sessionId: true },
    });
    if (!item) throw new AssessmentItemNotFoundException();
    return this.assessmentService.reviewQuestionBankItem(auth, schoolId, item.sessionId, itemId, data);
  }

  private isAdmin(auth: AuthContext) {
    return auth.principal.roles.some((role) => [MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN].includes(role));
  }

  /** Reused class-scope authority for teacher-owned assessment views. */
  async authorizedClassIds(auth: AuthContext, schoolId: string): Promise<string[] | null> {
    await this.assertTeacherScope(auth, schoolId);
    return this.isAdmin(auth) ? null : this.reviewableClassIds(auth, schoolId);
  }

  async assertAuthorizedClass(auth: AuthContext, schoolId: string, classId: string) {
    await this.assertTeacherScope(auth, schoolId);
    await this.assertReviewClass(auth, schoolId, classId);
  }

  private async assertTeacherScope(auth: AuthContext, schoolId: string) {
    if (auth.tenant.schoolId !== schoolId || !auth.principal.roles.some((role) => [MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN].includes(role))) {
      throw new AssessmentForbiddenException();
    }
  }

  private async reviewableClassIds(auth: AuthContext, schoolId: string) {
    if (this.isAdmin(auth)) return [];
    const rows = await this.prisma.enrollment.findMany({
      where: { userId: auth.principal.userId, schoolId, role: "TEACHER", status: "ACTIVE" },
      select: { classId: true },
    });
    return rows.map((row) => row.classId);
  }

  private async assertReviewClass(auth: AuthContext, schoolId: string, classId: string) {
    if (this.isAdmin(auth)) return;
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { userId: auth.principal.userId, schoolId, classId, role: "TEACHER", status: "ACTIVE" },
      select: { id: true },
    });
    if (!enrollment) throw new AssessmentForbiddenException("您不是该测评所属班级的任课教师");
  }

  private async practiceTitles(schoolId: string, ids: Array<string | null>) {
    const definitionIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (definitionIds.length === 0) return new Map<string, string>();
    const rows = await this.prisma.practiceDefinition.findMany({
      where: { id: { in: definitionIds }, OR: [{ schoolId }, { schoolId: null }] },
      select: { id: true, title: true },
    });
    return new Map(rows.map((row) => [row.id, row.title]));
  }
}
