import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import type { Prisma } from "@yuzan/database";
import { MembershipRole } from "../../common/security/index.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { AssessmentPolicy } from "./assessment.policy.js";
import { canTransition } from "./domain/assessment.state-machine.js";
import { AssessmentNotFoundException, AssessmentForbiddenException, AssessmentConflictException, AssessmentItemNotFoundException } from "./domain/assessment.errors.js";
import type { AssessmentSession, AssessmentSessionStatus } from "./domain/assessment.types.js";
import type { AssessmentSessionRepositoryPort, CreateAssessmentSessionData, ListSessionsOptions } from "./ports/assessment-session-repository.port.js";
import { ASSESSMENT_SESSION_REPOSITORY } from "./ports/assessment-session-repository.port.js";
import type { AssessmentItemRepositoryPort, CreateAssessmentItemData } from "./ports/assessment-item-repository.port.js";
import { ASSESSMENT_ITEM_REPOSITORY } from "./ports/assessment-item-repository.port.js";
import type { WrittenAnswerRepositoryPort, SaveWrittenAnswerData } from "./ports/written-answer-repository.port.js";
import { WRITTEN_ANSWER_REPOSITORY } from "./ports/written-answer-repository.port.js";
import type { AssessmentReportRepositoryPort, CreateAssessmentReportData } from "./ports/assessment-report-repository.port.js";
import { ASSESSMENT_REPORT_REPOSITORY } from "./ports/assessment-report-repository.port.js";
import { toAssessmentSessionResponse, toAssessmentItemResponse, toReadingItemResponse, toWrittenItemResponse, toWrittenAnswerResponse, toAssessmentReportResponse } from "./dto/assessment-session.response.js";

@Injectable()
export class AssessmentService {
  private readonly policy = new AssessmentPolicy();

  constructor(
    @Inject(ASSESSMENT_SESSION_REPOSITORY)
    private readonly sessionRepo: AssessmentSessionRepositoryPort,
    @Inject(ASSESSMENT_ITEM_REPOSITORY)
    private readonly itemRepo: AssessmentItemRepositoryPort,
    @Inject(WRITTEN_ANSWER_REPOSITORY)
    private readonly answerRepo: WrittenAnswerRepositoryPort,
    @Inject(ASSESSMENT_REPORT_REPOSITORY)
    private readonly reportRepo: AssessmentReportRepositoryPort,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  // ─── Session CRUD ─────────────────────────────────────

  async createSession(auth: AuthContext, schoolId: string, dto: { enrollmentId: string; classId: string; type: string; retestOfSessionId?: string }) {
    if (!this.policy.canCreateSession(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }

    // Verify teacher is assigned to this class
    const teacherEnrollment = await this.prisma.enrollment.findFirst({
      where: { userId: auth.principal.userId, schoolId, classId: dto.classId, role: "TEACHER", status: "ACTIVE" },
    });
    const isAdmin = auth.principal.roles.some((r) => r === "SCHOOL_ADMIN" || r === "PLATFORM_ADMIN");
    if (!teacherEnrollment && !isAdmin) {
      throw new AssessmentForbiddenException("您不是该班级的任课教师");
    }

    const data: CreateAssessmentSessionData = {
      schoolId,
      enrollmentId: dto.enrollmentId,
      classId: dto.classId,
      initiatorUserId: auth.principal.userId,
      type: dto.type as "READING" | "WRITTEN" | "MIXED",
      ...(dto.retestOfSessionId ? { retestOfSessionId: dto.retestOfSessionId } : {}),
    };

    const session = await this.sessionRepo.create(data);
    return toAssessmentSessionResponse(session);
  }

  async listSessions(auth: AuthContext, schoolId: string, options: ListSessionsOptions) {
    if (!this.policy.canReadSession(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }

    // Students can only see their own sessions
    if (auth.principal.roles.includes(MembershipRole.STUDENT) && !auth.principal.roles.includes(MembershipRole.TEACHER)) {
      const enrollments = await this.prisma.enrollment.findMany({
        where: { userId: auth.principal.userId, schoolId, status: "ACTIVE" },
        select: { id: true },
      });
      const enrollmentIds = enrollments.map((e) => e.id);
      if (options.enrollmentId && !enrollmentIds.includes(options.enrollmentId)) {
        throw new AssessmentForbiddenException();
      }
      // Filter to only the student's enrollments. An account with no active
      // enrollment must receive an empty page, never an unscoped query.
      if (enrollmentIds.length === 0) {
        return { items: [], nextCursor: null, hasMore: false };
      }
      options = { ...options, enrollmentId: enrollmentIds[0]! };
    }

    const result = await this.sessionRepo.list(schoolId, options);
    return {
      items: result.items.map(toAssessmentSessionResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async getSession(auth: AuthContext, schoolId: string, sessionId: string) {
    if (!this.policy.canReadSession(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }

    const session = await this.sessionRepo.findByIdAndSchool(sessionId, schoolId);
    if (!session) {
      throw new AssessmentNotFoundException();
    }

    await this.verifyAccess(auth, schoolId, session);
    return toAssessmentSessionResponse(session);
  }

  async startSession(auth: AuthContext, schoolId: string, sessionId: string) {
    if (!this.policy.canStartSession(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }

    const session = await this.sessionRepo.findByIdAndSchool(sessionId, schoolId);
    if (!session) {
      throw new AssessmentNotFoundException();
    }

    // Verify student owns this session
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id: session.enrollmentId, schoolId, userId: auth.principal.userId, status: "ACTIVE" },
    });
    if (!enrollment) {
      throw new AssessmentForbiddenException("您不是该测评的参与者");
    }

    if (!canTransition(session.status, "IN_PROGRESS")) {
      throw new AssessmentConflictException(`无法从 ${session.status} 转换为 IN_PROGRESS`);
    }

    const updated = await this.sessionRepo.updateStatus(sessionId, "IN_PROGRESS", { startedAt: new Date() } as Partial<AssessmentSession>);
    return toAssessmentSessionResponse(updated);
  }

  async submitSession(auth: AuthContext, schoolId: string, sessionId: string) {
    if (!this.policy.canSubmitSession(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }

    const session = await this.sessionRepo.findByIdAndSchool(sessionId, schoolId);
    if (!session) {
      throw new AssessmentNotFoundException();
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id: session.enrollmentId, schoolId, userId: auth.principal.userId, status: "ACTIVE" },
    });
    if (!enrollment) {
      throw new AssessmentForbiddenException("您不是该测评的参与者");
    }

    // Idempotent client retries return the persisted submission instead of a conflict.
    if (session.status === "SUBMITTED" || session.status === "PROCESSING" || session.status === "COMPLETED") {
      if (session.status !== "COMPLETED") {
        await this.finalizeAutomaticReportFromSpeechJob(schoolId, sessionId);
      }
      const current = await this.sessionRepo.findByIdAndSchool(sessionId, schoolId);
      return toAssessmentSessionResponse(current ?? session);
    }

    const items = await this.itemRepo.findBySessionId(sessionId);
    if (items.length === 0) throw new AssessmentConflictException("测评没有可提交的题目");
    const oralItems = items.filter((item) => ["READING", "SPEECH", "LISTEN_REPEAT", "READ_ALOUD"].includes(item.itemType));
    if (oralItems.some((item) => !item.recordingId)) {
      throw new AssessmentConflictException("仍有必做录音尚未同步");
    }
    const writtenItems = items.filter((item) => ["WRITTEN", "CHOICE", "FILL_BLANK", "SINGLE_CHOICE", "MULTIPLE_CHOICE", "SHORT_ANSWER", "LISTEN_RETELL"].includes(item.itemType));
    if (writtenItems.length) {
      const answers = await this.prisma.writtenAnswer.findMany({ where: { itemId: { in: writtenItems.map((item) => item.id) } }, select: { itemId: true, finalSubmittedAt: true } });
      const finalized = new Set(answers.filter((answer) => answer.finalSubmittedAt).map((answer) => answer.itemId));
      if (writtenItems.some((item) => !finalized.has(item.id))) throw new AssessmentConflictException("仍有必答书面题尚未保存");
    }
    const recordingIds = oralItems.flatMap((item) => item.recordingId ? [item.recordingId] : []);
    if (recordingIds.length) {
      const failed = await this.prisma.recording.count({ where: { id: { in: recordingIds }, status: "FAILED" } });
      if (failed) throw new AssessmentConflictException("存在阻塞性的音频上传错误");
    }

    if (!canTransition(session.status, "SUBMITTED")) {
      throw new AssessmentConflictException(`无法从 ${session.status} 转换为 SUBMITTED`);
    }

    const updated = await this.sessionRepo.updateStatus(sessionId, "SUBMITTED", { submittedAt: new Date() } as Partial<AssessmentSession>);
    await this.finalizeAutomaticReportFromSpeechJob(schoolId, sessionId);
    const current = await this.sessionRepo.findByIdAndSchool(sessionId, schoolId);
    return toAssessmentSessionResponse(current ?? updated);
  }

  // ─── Reading Assessment ────────────────────────────────

  async getReadingItem(auth: AuthContext, schoolId: string, sessionId: string, itemId: string) {
    if (!this.policy.canReadSession(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }

    const session = await this.sessionRepo.findByIdAndSchool(sessionId, schoolId);
    if (!session) throw new AssessmentNotFoundException();

    await this.verifyAccess(auth, schoolId, session);

    const item = await this.itemRepo.findByIdAndSession(itemId, sessionId);
    if (!item) throw new AssessmentItemNotFoundException();

    // Get question details if available
    let questionPrompt: Record<string, unknown> | undefined;
    let demoAudioUrl: string | null = typeof item.prompt.demoAudioUrl === "string" ? item.prompt.demoAudioUrl : null;
    if (item.questionId) {
      const question = await this.prisma.question.findUnique({
        where: { id: item.questionId },
        select: { prompt: true },
      });
      if (question) {
        questionPrompt = question.prompt as Record<string, unknown>;
      }
    }

    return questionPrompt
      ? toReadingItemResponse({ ...item, questionPrompt, demoAudioUrl })
      : toReadingItemResponse({ ...item, demoAudioUrl });
  }

  /**
   * List ALL assessment items for a session (read-only).
   * Used by the student assessment prep page to know which items to attempt
   * without requiring a hardcoded itemId.
   */
  async listSessionItems(auth: AuthContext, schoolId: string, sessionId: string) {
    if (!this.policy.canReadSession(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }

    const session = await this.sessionRepo.findByIdAndSchool(sessionId, schoolId);
    if (!session) throw new AssessmentNotFoundException();

    await this.verifyAccess(auth, schoolId, session);

    const items = await this.itemRepo.findBySessionId(sessionId);
    return items.map(toAssessmentItemResponse);
  }

  async attachRecording(auth: AuthContext, schoolId: string, sessionId: string, itemId: string, recordingId: string) {
    if (!this.policy.canSubmitSession(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }

    const session = await this.sessionRepo.findByIdAndSchool(sessionId, schoolId);
    if (!session) throw new AssessmentNotFoundException();

    // Verify student owns this session
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id: session.enrollmentId, schoolId, userId: auth.principal.userId, status: "ACTIVE" },
    });
    if (!enrollment) throw new AssessmentForbiddenException();

    const item = await this.itemRepo.findByIdAndSession(itemId, sessionId);
    if (!item) throw new AssessmentItemNotFoundException();

    // Verify recording belongs to this student
    const recording = await this.prisma.recording.findFirst({
      where: { id: recordingId, schoolId, enrollmentId: session.enrollmentId },
    });
    if (!recording) throw new AssessmentForbiddenException("录音不属于当前学生");

    const updated = await this.itemRepo.updateRecordingId(itemId, recordingId);
    return toAssessmentItemResponse(updated);
  }

  // ─── Written Assessment ────────────────────────────────

  async getWrittenItems(auth: AuthContext, schoolId: string, sessionId: string) {
    if (!this.policy.canReadSession(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }

    const session = await this.sessionRepo.findByIdAndSchool(sessionId, schoolId);
    if (!session) throw new AssessmentNotFoundException();

    await this.verifyAccess(auth, schoolId, session);

    const items = await this.itemRepo.findBySessionId(sessionId);
    const writtenItems = items.filter((i) => ["WRITTEN", "CHOICE", "FILL_BLANK", "SINGLE_CHOICE", "MULTIPLE_CHOICE", "SHORT_ANSWER", "LISTEN_RETELL"].includes(i.itemType));
    const answers = await this.answerRepo.findBySessionId(sessionId);
    const answersByItemId = new Map(answers.map((answer) => [answer.itemId, answer]));
    return writtenItems.map((item) => {
      const answer = answersByItemId.get(item.id);
      return {
        ...toWrittenItemResponse(item),
        answer: answer ? toWrittenAnswerResponse(answer) : null,
      };
    });
  }

  async saveWrittenAnswer(auth: AuthContext, schoolId: string, sessionId: string, itemId: string, content: Record<string, unknown>, wordCount?: number, charCount?: number) {
    if (!this.policy.canSubmitSession(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }

    const session = await this.sessionRepo.findByIdAndSchool(sessionId, schoolId);
    if (!session) throw new AssessmentNotFoundException();

    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id: session.enrollmentId, schoolId, userId: auth.principal.userId, status: "ACTIVE" },
    });
    if (!enrollment) throw new AssessmentForbiddenException();

    const item = await this.itemRepo.findByIdAndSession(itemId, sessionId);
    if (!item) throw new AssessmentItemNotFoundException();

    const data: SaveWrittenAnswerData = {
      itemId,
      content,
      wordCount: wordCount ?? 0,
      charCount: charCount ?? 0,
    };

    const answer = await this.answerRepo.upsert(data);
    return toWrittenAnswerResponse(answer);
  }

  async finalizeAnswer(auth: AuthContext, schoolId: string, sessionId: string, itemId: string) {
    if (!this.policy.canSubmitSession(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }

    const session = await this.sessionRepo.findByIdAndSchool(sessionId, schoolId);
    if (!session) throw new AssessmentNotFoundException();

    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id: session.enrollmentId, schoolId, userId: auth.principal.userId, status: "ACTIVE" },
    });
    if (!enrollment) throw new AssessmentForbiddenException();

    const answer = await this.answerRepo.finalize(itemId);
    await this.itemRepo.updateStatus(itemId, "ANSWERED");
    return toWrittenAnswerResponse(answer);
  }

  // ─── Report Generation ─────────────────────────────────

  async getReport(auth: AuthContext, schoolId: string, sessionId: string) {
    if (!this.policy.canReadSession(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }

    const session = await this.sessionRepo.findByIdAndSchool(sessionId, schoolId);
    if (!session) throw new AssessmentNotFoundException();

    await this.verifyAccess(auth, schoolId, session);

    const report = await this.reportRepo.findBySessionId(sessionId);
    if (!report) {
      return null;
    }
    return toAssessmentReportResponse(report);
  }

  async generateReport(auth: AuthContext, schoolId: string, sessionId: string) {
    if (!this.policy.canGenerateReport(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }

    const session = await this.sessionRepo.findByIdAndSchool(sessionId, schoolId);
    if (!session) throw new AssessmentNotFoundException();

    if (session.status !== "SUBMITTED" && session.status !== "PROCESSING") {
      throw new AssessmentConflictException("测评尚未提交，无法生成报告");
    }

    const existingReport = await this.reportRepo.findBySessionId(sessionId);
    if (existingReport) {
      return toAssessmentReportResponse(existingReport);
    }

    // Update to PROCESSING
    if (session.status === "SUBMITTED") {
      await this.sessionRepo.updateStatus(sessionId, "PROCESSING");
    }

    const items = await this.itemRepo.findBySessionId(sessionId);
    return this.createReportFromScoredItems({
      schoolId,
      sessionId,
      items,
      generatedByUserId: auth.principal.userId,
    });
  }

  /**
   * Finalize a report only when every current oral recording has an automatic
   * result. This is called from the trusted worker callback path, never from a
   * student request. A provider outage or a teacher-review requirement keeps
   * the attempt processing instead of fabricating a score.
   */
  async finalizeAutomaticReportFromSpeechJob(schoolId: string, sessionId: string) {
    const session = await this.sessionRepo.findByIdAndSchool(sessionId, schoolId);
    if (!session || session.status === "COMPLETED" || session.status === "CANCELLED") return null;
    if (session.status !== "SUBMITTED" && session.status !== "PROCESSING") return null;

    const existingReport = await this.reportRepo.findBySessionId(sessionId);
    if (existingReport) return toAssessmentReportResponse(existingReport);

    const items = await this.prisma.assessmentItem.findMany({
      where: { sessionId },
      include: { speechJobs: { orderBy: { createdAt: "desc" } } },
      orderBy: { sortOrder: "asc" },
    });
    const oralItems = items.filter((item) => ["READING", "SPEECH", "LISTEN_REPEAT", "READ_ALOUD"].includes(item.itemType));
    if (!oralItems.length) return null;

    const currentJobs = oralItems.map((item) =>
      item.speechJobs.find((job) => job.recordingId === item.recordingId) ?? null,
    );
    const allAutomaticallyScored = currentJobs.every((job) => job && (job.status === "AUTO_RESULT" || job.status === "FINALIZED"));
    if (!allAutomaticallyScored) {
      if (session.status === "SUBMITTED") await this.sessionRepo.updateStatus(sessionId, "PROCESSING");
      return null;
    }

    if (session.status === "SUBMITTED") await this.sessionRepo.updateStatus(sessionId, "PROCESSING");
    return this.createReportFromScoredItems({
      schoolId,
      sessionId,
      items,
    });
  }

  private async createReportFromScoredItems(input: {
    schoolId: string;
    sessionId: string;
    items: Array<{
      itemType: string;
      scoredScore: number | null;
    }>;
    generatedByUserId?: string;
  }) {
    const { schoolId, sessionId, items, generatedByUserId } = input;
    const scoredItems = items.filter((i) => i.scoredScore != null);

    const readingItems = scoredItems.filter((i) => ["READING", "SPEECH", "LISTEN_REPEAT", "READ_ALOUD"].includes(i.itemType));
    const writtenItems = scoredItems.filter((i) => ["WRITTEN", "CHOICE", "FILL_BLANK", "SINGLE_CHOICE", "MULTIPLE_CHOICE", "SHORT_ANSWER", "LISTEN_RETELL"].includes(i.itemType));

    const readingScore = readingItems.length > 0
      ? Math.round((readingItems.reduce((s, i) => s + (i.scoredScore ?? 0), 0) / readingItems.length) * 10) / 10
      : null;
    const writtenScore = writtenItems.length > 0
      ? Math.round((writtenItems.reduce((s, i) => s + (i.scoredScore ?? 0), 0) / writtenItems.length) * 10) / 10
      : null;
    const overallScore = scoredItems.length > 0
      ? Math.round((scoredItems.reduce((s, i) => s + (i.scoredScore ?? 0), 0) / scoredItems.length) * 10) / 10
      : null;

    const dataCompleteness = items.length > 0 ? (scoredItems.length / items.length) * 100 : 0;

    const reportData: CreateAssessmentReportData = {
      sessionId,
      schoolId,
      ...(overallScore !== null ? { overallScore } : {}),
      ...(readingScore !== null ? { readingScore } : {}),
      ...(writtenScore !== null ? { writtenScore } : {}),
      dataCompleteness,
      ...(generatedByUserId ? { generatedByUserId } : {}),
      summary: {
        totalItems: items.length,
        answeredItems: scoredItems.length,
        scoringState: "AUTO_RESULT",
        generatedAt: new Date().toISOString(),
      },
    };
    const report = await this.reportRepo.create(reportData);

    // Update session to COMPLETED
    await this.sessionRepo.updateStatus(sessionId, "COMPLETED", { completedAt: new Date() } as Partial<AssessmentSession>);

    return toAssessmentReportResponse(report);
  }

  // ─── Teacher Review ──────────────────────────────────────

  /**
   * Teacher reviews an assessment item: modifies final score and adds comment.
   */
  async reviewItem(
    auth: AuthContext,
    schoolId: string,
    sessionId: string,
    itemId: string,
    data: { scoredScore?: number; reviewerComment?: string },
  ) {
    if (!this.policy.canGenerateReport(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }

    const session = await this.sessionRepo.findByIdAndSchool(sessionId, schoolId);
    if (!session) throw new AssessmentNotFoundException();

    // Verify teacher is assigned to this class
    const teacherEnrollment = await this.prisma.enrollment.findFirst({
      where: { userId: auth.principal.userId, schoolId, classId: session.classId, role: "TEACHER", status: "ACTIVE" },
    });
    const isAdmin = auth.principal.roles.some((r) => r === "SCHOOL_ADMIN" || r === "PLATFORM_ADMIN");
    if (!teacherEnrollment && !isAdmin) {
      throw new AssessmentForbiddenException("您不是该班级的任课教师");
    }

    const item = await this.itemRepo.findByIdAndSession(itemId, sessionId);
    if (!item) throw new AssessmentItemNotFoundException();

    // Update item with teacher review
    const updated = await this.prisma.assessmentItem.update({
      where: { id: itemId },
      data: {
        ...(data.scoredScore !== undefined ? { scoredScore: data.scoredScore } : {}),
        ...(data.reviewerComment !== undefined ? { reviewerComment: data.reviewerComment } : {}),
        reviewerUserId: auth.principal.userId,
        reviewedAt: new Date(),
        status: "REVIEWED",
      },
    });

    return toAssessmentItemResponse({
      ...item,
      scoredScore: updated.scoredScore ?? item.scoredScore,
      reviewerUserId: updated.reviewerUserId,
      reviewerComment: updated.reviewerComment,
      reviewedAt: updated.reviewedAt,
      status: updated.status as "PENDING" | "ANSWERED" | "REVIEWED",
      revision: updated.revision,
    });
  }

  /**
   * Get recording download URL for teacher to listen.
   */
  async getItemRecordingEvidence(
    auth: AuthContext,
    schoolId: string,
    sessionId: string,
    itemId: string,
  ) {
    if (!this.policy.canReadSession(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }

    const session = await this.sessionRepo.findByIdAndSchool(sessionId, schoolId);
    if (!session) throw new AssessmentNotFoundException();

    const item = await this.itemRepo.findByIdAndSession(itemId, sessionId);
    if (!item) throw new AssessmentItemNotFoundException();
    if (!item.recordingId) {
      throw new AssessmentConflictException("该测评项没有关联录音");
    }

    // Return the recording ID so the frontend can use the recording evidence endpoint
    return { recordingId: item.recordingId };
  }

  // ─── Retest ────────────────────────────────────────────

  async scheduleRetest(auth: AuthContext, schoolId: string, sessionId: string) {
    if (!this.policy.canCreateSession(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }

    const originalSession = await this.sessionRepo.findByIdAndSchool(sessionId, schoolId);
    if (!originalSession) throw new AssessmentNotFoundException();

    if (originalSession.status !== "COMPLETED") {
      throw new AssessmentConflictException("只有已完成的测评才能安排重测");
    }

    // Create new session as retest
    const newSession = await this.sessionRepo.create({
      schoolId,
      enrollmentId: originalSession.enrollmentId,
      classId: originalSession.classId,
      initiatorUserId: auth.principal.userId,
      type: originalSession.type,
      retestOfSessionId: sessionId,
    });

    // Copy items from original session
    const originalItems = await this.itemRepo.findBySessionId(sessionId);
    if (originalItems.length > 0) {
      const newItems: CreateAssessmentItemData[] = originalItems.map((item) => ({
        sessionId: newSession.id,
        ...(item.questionId ? { questionId: item.questionId } : {}),
        prompt: item.prompt,
        itemType: item.itemType,
        sortOrder: item.sortOrder,
        ...(item.maxScore !== null ? { maxScore: item.maxScore } : {}),
      }));
      await this.itemRepo.createMany(newItems);
    }

    return toAssessmentSessionResponse(newSession);
  }

  // ─── Device Check ──────────────────────────────────────

  async logDeviceCheck(auth: AuthContext, schoolId: string, checkType: string, checkResult: Record<string, unknown>, userAgent?: string) {
    if (!this.policy.canDeviceCheck(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }

    await this.prisma.deviceCheckLog.create({
      data: {
        school: { connect: { id: schoolId } },
        userId: auth.principal.userId,
        checkType,
        checkResult: checkResult as unknown as Prisma.InputJsonValue,
        ...(userAgent ? { userAgent } : {}),
      },
    });

    return { logged: true };
  }

  // ─── Helpers ───────────────────────────────────────────

  private async verifyAccess(auth: AuthContext, schoolId: string, session: AssessmentSession) {
    const userId = auth.principal.userId;
    const isAdmin = auth.principal.roles.some((r) => r === "SCHOOL_ADMIN" || r === "PLATFORM_ADMIN");

    // Student can access own sessions
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id: session.enrollmentId, schoolId, userId, status: "ACTIVE" },
    });
    if (enrollment) return;

    // Teacher can access their class sessions
    const teacherEnrollment = await this.prisma.enrollment.findFirst({
      where: { userId, schoolId, classId: session.classId, role: "TEACHER", status: "ACTIVE" },
    });
    if (teacherEnrollment) return;

    if (isAdmin) return;

    throw new AssessmentForbiddenException();
  }

  // ─── Assessment History ──────────────────────────────────

  async getAssessmentHistory(
    auth: AuthContext,
    schoolId: string,
    options: { enrollmentId?: string; range?: "8w" | "6m" | "all" },
  ) {
    if (!this.policy.canReadSession(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }

    const userId = auth.principal.userId;

    // Resolve enrollmentId: if not provided, find the student's enrollment
    let enrollmentId = options.enrollmentId;
    if (!enrollmentId) {
      const enrollment = await this.prisma.enrollment.findFirst({
        where: { userId, schoolId, status: "ACTIVE", role: "STUDENT" },
        select: { id: true },
      });
      if (!enrollment) {
        return { sessions: [], metrics: null };
      }
      enrollmentId = enrollment.id;
    }

    // Access control: student sees own, teacher sees class students, admin sees all
    const targetEnrollment = await this.prisma.enrollment.findFirst({
      where: { id: enrollmentId, schoolId, status: "ACTIVE" },
      select: { userId: true, classId: true },
    });
    if (!targetEnrollment) {
      return { sessions: [], metrics: null };
    }

    const isSelf = targetEnrollment.userId === userId;
    const isAdmin = auth.principal.roles.some(
      (r) => r === "SCHOOL_ADMIN" || r === "PLATFORM_ADMIN",
    );
    let isTeacherOfClass = false;
    if (!isSelf && !isAdmin) {
      const teacherEnrollment = await this.prisma.enrollment.findFirst({
        where: { userId, schoolId, classId: targetEnrollment.classId, role: "TEACHER", status: "ACTIVE" },
      });
      isTeacherOfClass = !!teacherEnrollment;
    }
    if (!isSelf && !isAdmin && !isTeacherOfClass) {
      throw new AssessmentForbiddenException("无权查看该学生的测评历史");
    }

    // Calculate date range filter
    const now = new Date();
    let dateFilter: { gte: Date } | undefined;
    if (options.range === "8w") {
      dateFilter = { gte: new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000) };
    } else if (options.range === "6m") {
      dateFilter = { gte: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000) };
    }

    // Get completed sessions with reports
    const sessions = await this.prisma.assessmentSession.findMany({
      where: {
        enrollmentId,
        schoolId,
        status: "COMPLETED",
        ...(dateFilter ? { completedAt: dateFilter } : {}),
      },
      select: {
        id: true,
        type: true,
        completedAt: true,
        report: {
          select: {
            overallScore: true,
            readingScore: true,
            writtenScore: true,
            summary: true,
            recommendations: true,
            generatedAt: true,
          },
        },
      },
      orderBy: { completedAt: "desc" },
    });

    // Build history items with metric extraction
    const historyItems = sessions.map((s) => {
      const reportData = s.report;
      let metrics: Record<string, number> | null = null;
      if (reportData) {
        metrics = {};
        if (typeof reportData.overallScore === "number") metrics.overall = reportData.overallScore;
        if (typeof reportData.readingScore === "number") metrics.reading = reportData.readingScore;
        if (typeof reportData.writtenScore === "number") metrics.written = reportData.writtenScore;
        if (!Object.keys(metrics).length && reportData.summary && typeof reportData.summary === "object") {
          metrics = Object.fromEntries(Object.entries(reportData.summary as Record<string, unknown>).filter(([, value]) => typeof value === "number")) as Record<string, number>;
        }
        if (!Object.keys(metrics).length) metrics = null;
      }
      return {
        sessionId: s.id,
        type: s.type,
        completedAt: s.completedAt?.toISOString() ?? null,
        metrics,
        recommendations: reportData?.recommendations ?? null,
      };
    });

    // Calculate growth trend across sessions (reversed chronological → chronological)
    const chronological = [...historyItems].reverse();
    const dimensionTrends: Record<string, number[]> = {};
    for (const item of chronological) {
      if (!item.metrics) continue;
      for (const [key, value] of Object.entries(item.metrics)) {
        if (typeof value === "number") {
          if (!dimensionTrends[key]) dimensionTrends[key] = [];
          dimensionTrends[key].push(value);
        }
      }
    }

    return {
      enrollmentId,
      range: options.range ?? "all",
      sessions: historyItems,
      trends: dimensionTrends,
      totalSessions: historyItems.length,
    };
  }

  // ─── Assessment History Events ──────────────────────────

  /**
   * Returns teacher support events (feedback, interventions) for a student's assessment history.
   * This is used by the assessment history comparison page to show a timeline of teacher support.
   */
  async getAssessmentHistoryEvents(
    auth: AuthContext,
    schoolId: string,
    enrollmentId?: string,
  ) {
    if (!this.policy.canReadSession(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }

    const userId = auth.principal.userId;

    // Resolve enrollmentId if not provided
    if (!enrollmentId) {
      const enrollment = await this.prisma.enrollment.findFirst({
        where: { userId, schoolId, status: "ACTIVE", role: "STUDENT" },
        select: { id: true },
      });
      if (!enrollment) {
        return { events: [] };
      }
      enrollmentId = enrollment.id;
    }

    // Access control
    const targetEnrollment = await this.prisma.enrollment.findFirst({
      where: { id: enrollmentId, schoolId, status: "ACTIVE" },
      select: { userId: true, classId: true },
    });
    if (!targetEnrollment) {
      return { events: [] };
    }

    const isSelf = targetEnrollment.userId === userId;
    const isAdmin = auth.principal.roles.some((r) => r === "SCHOOL_ADMIN" || r === "PLATFORM_ADMIN");
    const isTeacherOfClass = !!(await this.prisma.enrollment.findFirst({
      where: { userId, schoolId, classId: targetEnrollment.classId, role: "TEACHER", status: "ACTIVE" },
      select: { id: true },
    }));

    if (!isSelf && !isAdmin && !isTeacherOfClass) {
      throw new AssessmentForbiddenException("无权查看该学生的测评支持事件");
    }

    // Get feedback events related to this student's assessment submissions
    const feedbacks = await this.prisma.feedback.findMany({
      where: {
        schoolId,
        submission: {
          enrollmentId,
          schoolId,
        },
        deletedAt: null,
      },
      select: {
        id: true,
        decision: true,
        comment: true,
        releasedAt: true,
        authorUserId: true,
        submission: {
          select: {
            assignmentId: true,
            assignment: { select: { title: true } },
          },
        },
      },
      orderBy: { releasedAt: "desc" },
      take: 50,
    });

    // Get assessment session completion events
    const completedSessions = await this.prisma.assessmentSession.findMany({
      where: {
        schoolId,
        enrollmentId,
        status: "COMPLETED",
      },
      select: {
        id: true,
        type: true,
        completedAt: true,
      },
      orderBy: { completedAt: "desc" },
      take: 20,
    });

    // Combine into a unified timeline
    const events: Array<{
      id: string;
      type: "FEEDBACK" | "ASSESSMENT_COMPLETED";
      title: string;
      description: string;
      timestamp: string;
      actorUserId?: string;
    }> = [];

    for (const fb of feedbacks) {
      events.push({
        id: fb.id,
        type: "FEEDBACK",
        title: fb.decision === "ACCEPT" ? "认可通过" : fb.decision === "RETURN" ? "需要改进" : "教师反馈",
        description: fb.comment ?? "",
        timestamp: fb.releasedAt.toISOString(),
        actorUserId: fb.authorUserId,
      });
    }

    for (const session of completedSessions) {
      if (session.completedAt) {
        events.push({
          id: session.id,
          type: "ASSESSMENT_COMPLETED",
          title: `${session.type === "READING" ? "朗读" : session.type === "WRITTEN" ? "书面" : "综合"}测评完成`,
          description: `完成了${session.type === "READING" ? "朗读" : session.type === "WRITTEN" ? "书面" : "综合"}测评`,
          timestamp: session.completedAt.toISOString(),
        });
      }
    }

    // Sort by timestamp descending
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      enrollmentId,
      events,
      totalEvents: events.length,
    };
  }

  // ─── Report Export ──────────────────────────────────────

  /**
   * Export an assessment report as structured data for PDF generation.
   * Records an audit log entry for privacy compliance.
   * NOTE: Actual PDF generation requires a rendering service (e.g., Puppeteer/pdf-lib).
   * This endpoint returns the full structured data that the frontend can
   * render into a PDF client-side, or that a future server-side renderer can consume.
   */
  async exportReport(
    auth: AuthContext,
    schoolId: string,
    sessionId: string,
    purpose?: string,
  ) {
    // Get session with report
    const session = await this.sessionRepo.findByIdAndSchool(sessionId, schoolId);
    if (!session) {
      throw new AssessmentNotFoundException();
    }

    // Access control: student self, teacher of class, or admin
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id: session.enrollmentId, schoolId, status: "ACTIVE" },
      select: { userId: true, classId: true },
    });

    if (!enrollment) {
      throw new AssessmentForbiddenException("找不到测评关联的学生");
    }

    const isSelf = auth.principal.userId === enrollment.userId;
    const isAdmin = auth.principal.roles.some((r) => r === "SCHOOL_ADMIN" || r === "PLATFORM_ADMIN");
    const isTeacherOfClass = !!(await this.prisma.enrollment.findFirst({
      where: { userId: auth.principal.userId, schoolId, classId: enrollment.classId, role: "TEACHER", status: "ACTIVE" },
      select: { id: true },
    }));

    if (!isSelf && !isAdmin && !isTeacherOfClass) {
      throw new AssessmentForbiddenException("无权导出该测评报告");
    }

    // Get the report
    const report = await this.reportRepo.findBySessionId(sessionId);
    if (!report) {
      throw new AssessmentConflictException("报告尚未生成，无法导出");
    }

    // Get items with answers for the report
    const items = await this.itemRepo.findBySessionId(sessionId);

    // Get recording evidence
    const recordingItems = items.filter((i) => i.recordingId);
    const recordings: { itemId: string; recordingId: string }[] = [];
    for (const item of recordingItems) {
      if (item.recordingId) {
        recordings.push({ itemId: item.id, recordingId: item.recordingId });
      }
    }

    // Get student info
    const student = await this.prisma.user.findUnique({
      where: { id: enrollment.userId },
      select: { displayName: true },
    });

    // Build export payload
    const exportData = {
      sessionId: session.id,
      type: session.type,
      status: session.status,
      completedAt: session.completedAt?.toISOString() ?? null,
      student: {
        userId: enrollment.userId,
        displayName: student?.displayName ?? "学生",
      },
      report: {
        overallScore: report.overallScore,
        readingScore: report.readingScore,
        writtenScore: report.writtenScore,
        summary: report.summary,
        recommendations: report.recommendations,
        dataCompleteness: report.dataCompleteness,
        generatedAt: report.generatedAt?.toISOString() ?? null,
      },
      items: items.map((i) => ({
        id: i.id,
        itemType: i.itemType,
        status: i.status,
        maxScore: i.maxScore,
        scoredScore: i.scoredScore,
        hasRecording: !!i.recordingId,
      })),
      recordings,
      exportedAt: new Date().toISOString(),
      exportedBy: auth.principal.userId,
      purpose: purpose ?? null,
      // PDF metadata for client-side rendering
      _pdfMeta: {
        title: `测评报告 - ${student?.displayName ?? "学生"}`,
        subtitle: `${session.type === "READING" ? "朗读测评" : session.type === "WRITTEN" ? "书面练习" : "综合测评"}`,
        generatedAt: new Date().toISOString(),
      },
    };

    // Write audit log for privacy compliance
    await this.prisma.auditLog.create({
      data: {
        actorUserId: auth.principal.userId,
        schoolId,
        action: "ASSESSMENT_REPORT_EXPORTED",
        resourceType: "AssessmentSession",
        resourceId: sessionId,
        requestId: `export-report-${Date.now()}`,
        afterSummary: {
          sessionId,
          purpose: purpose ?? "未说明",
          isSelf,
          isTeacher: isTeacherOfClass,
          isAdmin,
        } as unknown as import("@yuzan/database").Prisma.InputJsonValue,
      },
    });

    return exportData;
  }
}
