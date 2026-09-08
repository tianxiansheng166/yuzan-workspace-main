import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import type { Prisma } from "@yuzan/database";
import { MembershipRole } from "../../common/security/index.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { AssessmentPolicy } from "./assessment.policy.js";
import { canTransition } from "./domain/assessment.state-machine.js";
import { AssessmentNotFoundException, AssessmentForbiddenException, AssessmentConflictException, AssessmentItemNotFoundException, AssessmentValidationFailedException } from "./domain/assessment.errors.js";
import type { AssessmentSession, AssessmentSessionStatus } from "./domain/assessment.types.js";
import type { AssessmentSessionRepositoryPort, CreateAssessmentSessionData, ListSessionsOptions } from "./ports/assessment-session-repository.port.js";
import { ASSESSMENT_SESSION_REPOSITORY } from "./ports/assessment-session-repository.port.js";
import type { AssessmentItemRepositoryPort, CreateAssessmentItemData } from "./ports/assessment-item-repository.port.js";
import { ASSESSMENT_ITEM_REPOSITORY } from "./ports/assessment-item-repository.port.js";
import type { WrittenAnswerRepositoryPort, SaveWrittenAnswerData } from "./ports/written-answer-repository.port.js";
import { WRITTEN_ANSWER_REPOSITORY } from "./ports/written-answer-repository.port.js";
import type { AssessmentReportRepositoryPort, CreateAssessmentReportData } from "./ports/assessment-report-repository.port.js";
import { ASSESSMENT_REPORT_REPOSITORY } from "./ports/assessment-report-repository.port.js";
import { QuestionBankDeterministicScoringService } from "./question-bank-deterministic-scoring.service.js";
import { buildQuestionBankDiagnosis, isQuestionBankDiagnosis, QuestionBankDiagnosisError, questionBankFamilyLearningDetail, QUESTION_BANK_FAMILY_ORDER, type QuestionBankDiagnosis, type QuestionBankRetryCandidate } from "./question-bank-diagnosis.js";
import { assertSafeQuestionDeliverySpec } from "./question-bank-delivery.js";
import { toAssessmentSessionResponse, toAssessmentItemResponse, toReadingItemResponse, toWrittenItemResponse, toWrittenAnswerResponse, toAssessmentReportResponse } from "./dto/assessment-session.response.js";

const REMEDIATION_PRACTICE_TAGS: Record<string, readonly string[]> = {
  LISTEN_IMAGE_CHOICE: ["听辨训练"],
  DICTATION: ["听辨训练", "听后复述", "书面表达"],
  READ_ALOUD: ["独立朗读", "跟读模仿", "发音基础"],
  PICTURE_SPEAKING: ["口语交际", "听后复述"],
  WORD_RECOGNITION: ["独立朗读", "发音基础"],
  SENTENCE_COMPREHENSION: ["阅读理解"],
  PICTURE_WORD: ["书面表达"],
  SENTENCE_COMPLETION: ["书面表达"],
};

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
    @Inject(QuestionBankDeterministicScoringService)
    private readonly questionBankScoring: QuestionBankDeterministicScoringService,
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

  /**
   * Create one student-owned retry attempt from the immutable diagnosis stored
   * on a completed formal Question Bank session. The client deliberately
   * supplies no item ids, family filters, or answers.
   */
  async createOrResumeRemediation(auth: AuthContext, schoolId: string, sourceSessionId: string) {
    if (!this.policy.canSubmitSession(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }

    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        schoolId,
        userId: auth.principal.userId,
        role: "STUDENT",
        status: "ACTIVE",
      },
      select: { id: true, classId: true },
    });
    if (!enrollment) throw new AssessmentForbiddenException("当前用户没有有效的学生班级关系");

    return this.prisma.$transaction(async (tx) => {
      const source = await this.remediationSource(tx, { id: sourceSessionId, schoolId });

      if (!source) throw new AssessmentNotFoundException();
      if (source.enrollmentId !== enrollment.id || source.classId !== enrollment.classId) {
        throw new AssessmentForbiddenException("无权为其他学生创建专项巩固练习");
      }
      const diagnosis = this.persistedDiagnosis(source.report?.summary);
      if (!diagnosis || source.items.length !== 20 || source.items.some((item: { questionVersionId: string | null }) => !item.questionVersionId)) {
        throw new AssessmentConflictException("该测评没有可用于巩固练习的正式题库诊断");
      }
      const candidates = this.validatedRetryCandidates(diagnosis.retryCandidates, source.items);
      const result = await this.createOrResumeRemediationFromCandidates(tx, {
        schoolId,
        enrollment,
        actorUserId: auth.principal.userId,
        source,
        origin: "SELF_INITIATED",
        focus: { mode: "ALL_RETRY" },
        candidates,
      });
      return result ?? {
        outcome: "NO_REMEDIATION_NEEDED" as const,
        sourceSessionId: source.id,
        attemptId: null,
        status: null,
        itemCount: 0,
        resumed: false,
      };
    });
  }

  /** Teacher callers provide only a validated class enrollment and focus; the
   * source session and exact question versions remain server-authoritative. */
  async createTeacherAssignedRemediation(input: {
    schoolId: string;
    enrollment: { id: string; classId: string };
    actorUserId: string;
    practiceDefinitionId: string;
    focus: { mode: "ALL_RETRY" } | { mode: "FAMILY"; family: string };
  }) {
    return this.prisma.$transaction(async (tx) => {
      const source = await this.remediationSource(tx, {
        schoolId: input.schoolId,
        enrollmentId: input.enrollment.id,
        classId: input.enrollment.classId,
        practiceDefinitionId: input.practiceDefinitionId,
        purpose: "STANDARD",
        status: "COMPLETED",
      }, { completedAt: "desc" });
      if (!source || !this.persistedDiagnosis(source.report?.summary) || source.items.length !== 20) {
        return { outcome: "NO_COMPLETED_ASSESSMENT" as const, attemptId: null, status: null, itemCount: 0, resumed: false };
      }
      const diagnosis = this.persistedDiagnosis(source.report.summary)!;
      const candidates = this.validatedRetryCandidates(diagnosis.retryCandidates, source.items)
        .filter((candidate) => input.focus.mode === "ALL_RETRY" || candidate.family === input.focus.family);
      const result = await this.createOrResumeRemediationFromCandidates(tx, {
        schoolId: input.schoolId,
        enrollment: input.enrollment,
        actorUserId: input.actorUserId,
        source,
        origin: "TEACHER_ASSIGNED",
        focus: input.focus,
        candidates,
      });
      return result ?? { outcome: "NO_MATCHING_RETRY_CANDIDATES" as const, attemptId: null, status: null, itemCount: 0, resumed: false };
    });
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

  /** Student-safe discovery surface for teacher-authorized remediation only. */
  async listAssignedRemediations(auth: AuthContext, schoolId: string) {
    if (!this.policy.canReadSession(auth, schoolId) || !auth.principal.roles.includes(MembershipRole.STUDENT)) {
      throw new AssessmentForbiddenException();
    }
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { schoolId, userId: auth.principal.userId, role: "STUDENT", status: "ACTIVE" },
      select: { id: true },
    });
    if (!enrollment) throw new AssessmentForbiddenException("当前用户没有有效的学生班级关系");
    const sessions = await this.prisma.assessmentSession.findMany({
      where: {
        schoolId,
        enrollmentId: enrollment.id,
        purpose: "REMEDIATION",
        remediationOrigin: "TEACHER_ASSIGNED",
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        completedAt: true,
        initiatorUserId: true,
        remediationFocus: true,
        practiceDefinitionId: true,
        items: { select: { maxScore: true, scoredScore: true } },
      },
    });
    const userIds = [...new Set(sessions.map((session) => session.initiatorUserId))];
    const teachers = userIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, displayName: true } })
      : [];
    const definitionIds = [...new Set(sessions.map((session) => session.practiceDefinitionId).filter((id): id is string => Boolean(id)))];
    const definitions = definitionIds.length
      ? await this.prisma.practiceDefinition.findMany({ where: { id: { in: definitionIds } }, select: { id: true, title: true, difficulty: true } })
      : [];
    const teacherNames = new Map(teachers.map((teacher) => [teacher.id, teacher.displayName]));
    const definitionById = new Map(definitions.map((definition) => [definition.id, definition]));
    const active = new Set(["CREATED", "IN_PROGRESS", "SUBMITTED", "PROCESSING"]);
    return {
      items: sessions
        .sort((left, right) => Number(active.has(right.status)) - Number(active.has(left.status)) || right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id))
        .map((session) => {
          const definition = session.practiceDefinitionId ? definitionById.get(session.practiceDefinitionId) : null;
          const maxPoints = session.items.reduce((total, item) => total + (item.maxScore ?? 0), 0);
          const earnedPoints = session.items.reduce((total, item) => total + (item.scoredScore ?? 0), 0);
          return {
            attemptId: session.id,
            practiceTitle: definition?.title ?? "专项巩固",
            level: definition?.difficulty ?? null,
            focus: this.safeRemediationFocus(session.remediationFocus),
            itemCount: session.items.length,
            status: session.status,
            createdAt: session.createdAt.toISOString(),
            completedAt: session.completedAt?.toISOString() ?? null,
            teacherDisplayName: teacherNames.get(session.initiatorUserId) ?? null,
            result: session.status === "COMPLETED" ? {
              earnedPoints,
              maxPoints,
              percentage: maxPoints > 0 ? Math.round(((earnedPoints / maxPoints) * 100 + Number.EPSILON) * 100) / 100 : 0,
            } : null,
          };
        }),
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
    const includeScoring = ["SUBMITTED", "PROCESSING", "COMPLETED"].includes(session.status);
    const staffViewer = auth.principal.roles.some((role) => [MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN].includes(role));
    return items.map((item) => toAssessmentItemResponse(item, { includeScoring, viewer: staffViewer ? "staff" : "student" }));
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
    return toAssessmentItemResponse(updated, { includeScoring: ["SUBMITTED", "PROCESSING", "COMPLETED"].includes(session.status), viewer: "student" });
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

    if (this.purposeOf(session) === "REMEDIATION") {
      // A subset retry attempt has a result, never a formal AssessmentReport.
      return null;
    }

    const report = await this.reportRepo.findBySessionId(sessionId);
    if (!report) {
      return null;
    }
    return toAssessmentReportResponse(report, { includeDiagnosis: session.status === "COMPLETED" });
  }

  async generateReport(auth: AuthContext, schoolId: string, sessionId: string) {
    if (!this.policy.canGenerateReport(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }

    const session = await this.sessionRepo.findByIdAndSchool(sessionId, schoolId);
    if (!session) throw new AssessmentNotFoundException();

    if (this.purposeOf(session) === "REMEDIATION") {
      throw new AssessmentConflictException("专项巩固练习不生成正式测评报告");
    }

    if (session.status !== "SUBMITTED" && session.status !== "PROCESSING") {
      throw new AssessmentConflictException("测评尚未提交，无法生成报告");
    }

    await this.questionBankScoring.scoreSession(sessionId);

    const items = await this.reportItemsForSession(sessionId);
    if (this.hasIncompleteQuestionBankScoring(items)) {
      if (session.status === "SUBMITTED") await this.sessionRepo.updateStatus(sessionId, "PROCESSING");
      return null;
    }

    const existingReport = await this.reportRepo.findBySessionId(sessionId);
    if (existingReport) {
      return toAssessmentReportResponse(existingReport);
    }

    // Update to PROCESSING
    if (session.status === "SUBMITTED") {
      await this.sessionRepo.updateStatus(sessionId, "PROCESSING");
    }
    return this.createReportFromScoredItems({
      schoolId,
      sessionId,
      items,
      generatedByUserId: auth.principal.userId,
    });
  }

  async getRemediationResult(auth: AuthContext, schoolId: string, sessionId: string) {
    if (!this.policy.canReadSession(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }
    const session = await this.sessionRepo.findByIdAndSchool(sessionId, schoolId);
    if (!session) throw new AssessmentNotFoundException();
    await this.verifyAccess(auth, schoolId, session);
    if (this.purposeOf(session) !== "REMEDIATION" || !session.retestOfSessionId) {
      throw new AssessmentConflictException("当前会话不是专项巩固练习");
    }

    const items = await this.prisma.assessmentItem.findMany({
      where: { sessionId },
      select: {
        id: true,
        itemType: true,
        sortOrder: true,
        maxScore: true,
        scoredScore: true,
        autoResult: true,
        questionVersion: { select: { item: { select: { domain: true, questionType: true } } } },
      },
      orderBy: { sortOrder: "asc" },
    });
    if (!items.length || items.some((item) => item.maxScore == null || !Number.isFinite(item.maxScore))) {
      throw new AssessmentConflictException("专项巩固练习题目配置无效");
    }

    const referencePoints = (item: { maxScore: number | null; scoredScore: number | null; autoResult: unknown }) => {
      if (item.scoredScore != null) return item.scoredScore;
      const candidate = item.autoResult && typeof item.autoResult === "object" && !Array.isArray(item.autoResult)
        ? (item.autoResult as Record<string, unknown>).candidatePoints
        : null;
      return typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0 && candidate <= (item.maxScore ?? -1)
        ? candidate
        : null;
    };
    const completedItemCount = items.filter((item) => item.scoredScore != null).length;
    const pendingItemCount = items.length - completedItemCount;
    const earnedPoints = items.reduce((total, item) => total + (item.scoredScore ?? 0), 0);
    const maxPoints = items.reduce((total, item) => total + (item.maxScore ?? 0), 0);
    const referenceItems = items.map((item) => ({ item, points: referencePoints(item) }));
    const referenceScoredItems = referenceItems.filter((entry) => entry.points != null);
    const referenceEarnedPoints = referenceScoredItems.reduce((total, entry) => total + (entry.points ?? 0), 0);
    const referenceMaxPoints = referenceScoredItems.reduce((total, entry) => total + (entry.item.maxScore ?? 0), 0);
    const humanReviewItemCount = items.length - referenceScoredItems.length;
    const familyMap = new Map<string, {
      family: string;
      displayName: string;
      guidance: string | null;
      domain: string;
      earnedPoints: number;
      maxPoints: number;
      itemCount: number;
    }>();
    for (const item of items) {
      const family = item.questionVersion?.item.questionType;
      const domain = item.questionVersion?.item.domain;
      if (!family || !domain) {
        throw new AssessmentConflictException("专项巩固练习缺少题库元数据");
      }
      const detail = questionBankFamilyLearningDetail(family);
      const current = familyMap.get(family) ?? {
        family,
        displayName: detail?.displayName ?? family,
        guidance: detail?.guidance ?? null,
        domain,
        earnedPoints: 0,
        maxPoints: 0,
        itemCount: 0,
      };
      current.earnedPoints += item.scoredScore ?? 0;
      current.maxPoints += item.maxScore ?? 0;
      current.itemCount += 1;
      familyMap.set(family, current);
    }

    const families = [...familyMap.values()].map((family) => ({
      ...family,
      percentage: family.maxPoints > 0
        ? Math.round(((family.earnedPoints / family.maxPoints) * 100 + Number.EPSILON) * 100) / 100
        : 0,
    }));
    const priorityFamilies = families
      .filter((family) => family.earnedPoints < family.maxPoints)
      .sort((left, right) =>
        left.percentage - right.percentage ||
        (right.maxPoints - right.earnedPoints) - (left.maxPoints - left.earnedPoints) ||
        left.family.localeCompare(right.family),
      );
    const deliveries = await this.prisma.practiceDelivery.findMany({
      where: {
        schoolId,
        status: "OPEN",
        OR: [{ studentId: auth.principal.userId }, { studentId: null, classId: session.classId }],
        AND: [{ OR: [{ deadline: null }, { deadline: { gte: new Date() } }] }],
      },
      select: {
        practiceVersion: {
          select: {
            definition: {
              select: { id: true, title: true, summary: true, difficulty: true, estimatedMinutes: true, abilityCategories: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    const usedPracticeIds = new Set<string>();
    const recommendations = priorityFamilies.flatMap((family) => {
      const tags = REMEDIATION_PRACTICE_TAGS[family.family] ?? [];
      const delivery = deliveries.find(({ practiceVersion }) => {
        const definition = practiceVersion.definition;
        return !usedPracticeIds.has(definition.id) &&
          definition.abilityCategories.some((category) => tags.includes(category));
      });
      if (!delivery) return [];
      const definition = delivery.practiceVersion.definition;
      usedPracticeIds.add(definition.id);
      return [{
        practiceDefinitionId: definition.id,
        title: definition.title,
        summary: definition.summary,
        difficulty: definition.difficulty,
        estimatedMinutes: definition.estimatedMinutes,
        abilityCategories: definition.abilityCategories,
        targetFamily: family.displayName,
        guidance: family.guidance,
        reason: `本次“${family.displayName}”得分 ${family.percentage}% ，建议优先练习。`,
      }];
    }).slice(0, 3);

    return {
      sourceSessionId: session.retestOfSessionId,
      status: session.status,
      itemCount: items.length,
      earnedPoints,
      maxPoints,
      percentage: maxPoints > 0 ? Math.round(((earnedPoints / maxPoints) * 100 + Number.EPSILON) * 100) / 100 : 0,
      completedItemCount,
      pendingItemCount,
      referenceReady: referenceScoredItems.length > 0,
      referenceItemCount: referenceScoredItems.length,
      humanReviewItemCount,
      referenceEarnedPoints,
      referenceMaxPoints,
      referencePercentage: referenceMaxPoints > 0 ? Math.round(((referenceEarnedPoints / referenceMaxPoints) * 100 + Number.EPSILON) * 100) / 100 : null,
      families,
      recommendations,
      items: items.map((item) => ({
        itemId: item.id,
        itemType: item.itemType,
        sortOrder: item.sortOrder,
        earnedPoints: item.scoredScore,
        referencePoints: referencePoints(item),
        maxPoints: item.maxScore,
        completed: item.scoredScore != null,
      })),
    };
  }

  /**
   * Finalize a report only when every current oral recording has an automatic
   * result. This is called from the trusted worker callback path, never from a
   * student request. A provider outage keeps the attempt processing. A model
   * result that needs teacher review is reported truthfully with that state.
   */
  async finalizeAutomaticReportFromSpeechJob(schoolId: string, sessionId: string) {
    const session = await this.sessionRepo.findByIdAndSchool(sessionId, schoolId);
    if (!session || session.status === "COMPLETED" || session.status === "CANCELLED") return null;
    if (session.status !== "SUBMITTED" && session.status !== "PROCESSING") return null;

    if (this.purposeOf(session) === "REMEDIATION") {
      return this.finalizeRemediationIfComplete(schoolId, sessionId);
    }

    await this.questionBankScoring.scoreSession(sessionId);

    const items = await this.prisma.assessmentItem.findMany({
      where: { sessionId },
        include: {
          speechJobs: { orderBy: { createdAt: "desc" } },
          questionVersion: { select: { item: { select: { domain: true, questionType: true, level: true } } } },
        },
      orderBy: { sortOrder: "asc" },
    });
    const questionBankItems = items.filter((item) => item.questionVersionId !== null);
    if (questionBankItems.length && this.hasIncompleteQuestionBankScoring(items)) {
      if (session.status === "SUBMITTED") await this.sessionRepo.updateStatus(sessionId, "PROCESSING");
      return null;
    }

    const existingReport = await this.reportRepo.findBySessionId(sessionId);
    if (existingReport) return toAssessmentReportResponse(existingReport, { includeDiagnosis: true });

    const oralItems = items.filter((item) => ["READING", "SPEECH", "LISTEN_REPEAT", "READ_ALOUD"].includes(item.itemType));
    if (!oralItems.length) {
      if (questionBankItems.length && session.status === "SUBMITTED") await this.sessionRepo.updateStatus(sessionId, "PROCESSING");
      return null;
    }

    const currentJobs = oralItems.map((item) =>
      item.speechJobs.find((job) => job.recordingId === item.recordingId) ?? null,
    );
    const allModelScored = currentJobs.every((job) => job && ["AUTO_RESULT", "FINALIZED", "NEEDS_REVIEW"].includes(job.status));
    if (!allModelScored) {
      if (session.status === "SUBMITTED") await this.sessionRepo.updateStatus(sessionId, "PROCESSING");
      return null;
    }

    const requiresTeacherReview = currentJobs.some((job) => job?.status === "NEEDS_REVIEW");

    if (questionBankItems.length && requiresTeacherReview) {
      if (session.status === "SUBMITTED") await this.sessionRepo.updateStatus(sessionId, "PROCESSING");
      return null;
    }

    if (session.status === "SUBMITTED") await this.sessionRepo.updateStatus(sessionId, "PROCESSING");
    return this.createReportFromScoredItems({
      schoolId,
      sessionId,
      items: items.map((item) => ({
        ...item,
        domain: item.questionVersion?.item.domain ?? null,
        family: item.questionVersion?.item.questionType ?? null,
        level: item.questionVersion?.item.level ?? null,
      })),
      requiresTeacherReview,
    });
  }

  private async createReportFromScoredItems(input: {
    schoolId: string;
    sessionId: string;
    items: Array<{
      questionVersionId?: string | null;
      id?: string;
      itemType: string;
      sortOrder?: number;
      maxScore?: number | null;
      scoredScore: number | null;
      domain?: string | null;
      family?: string | null;
      level?: string | null;
    }>;
    generatedByUserId?: string;
    requiresTeacherReview?: boolean;
  }) {
    const { schoolId, sessionId, items, generatedByUserId, requiresTeacherReview = false } = input;
    const questionBankItems = items.filter((item) => item.questionVersionId != null);
    const isQuestionBank = questionBankItems.length > 0;
    const isPureQuestionBank = isQuestionBank && questionBankItems.length === items.length;
    if (isQuestionBank && this.hasIncompleteQuestionBankScoring(items)) return null;
    const scoredItems = items.filter((i) => i.scoredScore != null);

    const readingItems = scoredItems.filter((i) => ["READING", "SPEECH", "LISTEN_REPEAT", "READ_ALOUD"].includes(i.itemType));
    const writtenItems = scoredItems.filter((i) => isQuestionBank
      ? !["READING", "SPEECH", "LISTEN_REPEAT", "READ_ALOUD"].includes(i.itemType)
      : ["WRITTEN", "CHOICE", "FILL_BLANK", "SINGLE_CHOICE", "MULTIPLE_CHOICE", "SHORT_ANSWER", "LISTEN_RETELL"].includes(i.itemType));

    const readingScore = readingItems.length > 0
      ? isQuestionBank
        ? readingItems.reduce((s, i) => s + (i.scoredScore ?? 0), 0)
        : Math.round((readingItems.reduce((s, i) => s + (i.scoredScore ?? 0), 0) / readingItems.length) * 10) / 10
      : null;
    const writtenScore = writtenItems.length > 0
      ? isQuestionBank
        ? writtenItems.reduce((s, i) => s + (i.scoredScore ?? 0), 0)
        : Math.round((writtenItems.reduce((s, i) => s + (i.scoredScore ?? 0), 0) / writtenItems.length) * 10) / 10
      : null;
    const overallScore = scoredItems.length > 0
      ? isQuestionBank
        ? scoredItems.reduce((s, i) => s + (i.scoredScore ?? 0), 0)
        : Math.round((scoredItems.reduce((s, i) => s + (i.scoredScore ?? 0), 0) / scoredItems.length) * 10) / 10
      : null;

    const dataCompleteness = items.length > 0 ? (scoredItems.length / items.length) * 100 : 0;

    let diagnosis: QuestionBankDiagnosis | null = null;
    if (isPureQuestionBank) {
      try {
        diagnosis = buildQuestionBankDiagnosis(questionBankItems.map((item) => ({
          assessmentItemId: item.id ?? "",
          questionVersionId: item.questionVersionId ?? "",
          sortOrder: item.sortOrder ?? Number.NaN,
          domain: item.domain ?? null,
          family: item.family ?? null,
          level: item.level ?? null,
          earned: item.scoredScore,
          max: item.maxScore ?? null,
        })));
      } catch (error) {
        if (error instanceof QuestionBankDiagnosisError) {
          throw new AssessmentValidationFailedException(`无法生成题库能力诊断：${error.message}`);
        }
        throw error;
      }
    }

    const domainScores: Record<string, { awardedPoints: number; totalMaxPoints: number }> = {};
    if (isQuestionBank) {
      for (const item of questionBankItems) {
        const domain = typeof item.domain === "string" ? item.domain.trim().toUpperCase() : "";
        if (!domain) continue;
        const current = domainScores[domain] ?? { awardedPoints: 0, totalMaxPoints: 0 };
        current.totalMaxPoints += item.maxScore ?? 0;
        if (item.scoredScore !== null) current.awardedPoints += item.scoredScore;
        domainScores[domain] = current;
      }
    }

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
        scoringState: requiresTeacherReview ? "NEEDS_REVIEW" : "AUTO_RESULT",
        requiresTeacherReview,
        ...(isQuestionBank ? {
          aggregation: "POINTS",
          awardedPoints: scoredItems.reduce((sum, item) => sum + (item.scoredScore ?? 0), 0),
          totalMaxPoints: questionBankItems.reduce((sum, item) => sum + (item.maxScore ?? 0), 0),
          domainScores,
          ...(diagnosis ? { diagnosis } : {}),
        } : {}),
        generatedAt: new Date().toISOString(),
      },
    };
    const report = await this.reportRepo.create(reportData);

    // Update session to COMPLETED
    await this.sessionRepo.updateStatus(sessionId, "COMPLETED", { completedAt: new Date() } as Partial<AssessmentSession>);

    return toAssessmentReportResponse(report, { includeDiagnosis: Boolean(diagnosis) });
  }

  /** Select immutable public metadata only; diagnosis never reads scoringSpec or provider evidence. */
  private async reportItemsForSession(sessionId: string) {
    const items = await this.prisma.assessmentItem.findMany({
      where: { sessionId },
      select: { id: true, questionVersionId: true, itemType: true, sortOrder: true, maxScore: true, scoredScore: true, questionVersion: { select: { item: { select: { domain: true, questionType: true, level: true } } } } },
      orderBy: { sortOrder: "asc" },
    });
    return items.map((item) => ({ ...item, domain: item.questionVersion?.item.domain ?? null, family: item.questionVersion?.item.questionType ?? null, level: item.questionVersion?.item.level ?? null }));
  }

  private hasIncompleteQuestionBankScoring(items: Array<{
    questionVersionId?: string | null;
    maxScore?: number | null;
    scoredScore: number | null;
  }>) {
    const questionBankItems = items.filter((item) => item.questionVersionId != null);
    return questionBankItems.length > 0 && (
      questionBankItems.length !== items.length
      || questionBankItems.length !== 20
      || questionBankItems.some((item) => item.maxScore == null || item.scoredScore == null)
    );
  }

  private hasIncompleteRemediationScoring(items: Array<{
    questionVersionId?: string | null;
    maxScore?: number | null;
    scoredScore: number | null;
  }>) {
    return items.length === 0 || items.some((item) => (
      item.questionVersionId == null ||
      item.maxScore == null ||
      !Number.isFinite(item.maxScore) ||
      item.maxScore <= 0 ||
      item.scoredScore == null ||
      !Number.isFinite(item.scoredScore) ||
      item.scoredScore < 0 ||
      item.scoredScore > item.maxScore
    ));
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
    if (data.scoredScore === undefined) {
      throw new AssessmentValidationFailedException("教师复核必须提交正式分数");
    }
    const result = await this.reviewQuestionBankItem(auth, schoolId, sessionId, itemId, {
      score: data.scoredScore,
      ...(data.reviewerComment !== undefined ? { comment: data.reviewerComment } : {}),
    });
    const item = await this.itemRepo.findByIdAndSession(itemId, sessionId);
    if (!item) throw new AssessmentItemNotFoundException();

    return toAssessmentItemResponse({
      ...item,
      scoredScore: result.item.scoredScore,
      reviewerUserId: result.item.reviewerUserId,
      reviewerComment: result.item.reviewerComment,
      reviewedAt: result.item.reviewedAt,
      status: result.item.status as "PENDING" | "ANSWERED" | "REVIEWED",
      revision: result.item.revision,
    });
  }

  /**
   * Persist one allowed human-review score with an optimistic conditional
   * update. Question Bank scoringSpec and autoResult remain immutable here.
   */
  async reviewQuestionBankItem(
    auth: AuthContext,
    schoolId: string,
    sessionId: string,
    itemId: string,
    data: { score?: number; comment?: string },
  ) {
    this.assertReviewActor(auth, schoolId);
    if (data.score === undefined || !Number.isFinite(data.score)) {
      throw new AssessmentValidationFailedException("复核分数必须是有限数字");
    }
    if (data.comment !== undefined && data.comment.length > 2000) {
      throw new AssessmentValidationFailedException("复核意见不能超过 2000 个字符");
    }

    const item = await this.prisma.assessmentItem.findFirst({
      where: { id: itemId, sessionId, session: { schoolId } },
      select: {
        id: true,
        sessionId: true,
        maxScore: true,
        scoredScore: true,
        reviewerUserId: true,
        reviewerComment: true,
        reviewedAt: true,
        revision: true,
        status: true,
        autoResult: true,
        session: { select: { id: true, schoolId: true, classId: true, status: true } },
        questionVersion: {
          select: { status: true, scoringSpec: true, item: { select: { domain: true } } },
        },
      },
    });
    if (!item) throw new AssessmentItemNotFoundException();
    await this.assertReviewClass(auth, schoolId, item.session.classId);
    if (item.session.status !== "SUBMITTED" && item.session.status !== "PROCESSING") {
      throw new AssessmentConflictException("当前测评不在待复核状态");
    }
    if (!item.questionVersion || item.questionVersion.status !== "PUBLISHED") {
      throw new AssessmentConflictException("复核题目没有可用的已发布题库版本");
    }
    const scoringSpec = this.asScoringSpecRecord(item.questionVersion.scoringSpec);
    const strategy = typeof scoringSpec?.strategy === "string" ? scoringSpec.strategy : "";
    if (!["RUBRIC_TEXT", "SPEECH_READING", "SPEECH_OPEN_RESPONSE"].includes(strategy)) {
      throw new AssessmentConflictException("该题型不允许人工复核");
    }
    const maxScore = item.maxScore;
    const specMaxScore = typeof scoringSpec?.maxScore === "number" ? scoringSpec.maxScore : null;
    if (maxScore === null || specMaxScore === null || maxScore !== specMaxScore) {
      throw new AssessmentValidationFailedException("题目分值配置无效");
    }
    if (data.score < 0 || data.score > maxScore) {
      throw new AssessmentValidationFailedException(`复核分数必须在 0 到 ${maxScore} 分之间`);
    }

    if (item.scoredScore !== null) {
      if (item.reviewerUserId === auth.principal.userId && item.scoredScore === data.score) {
        return { item, report: await this.finalizeQuestionBankIfComplete(schoolId, sessionId, auth.principal.userId) };
      }
      throw new AssessmentConflictException("该题已被其他复核结果占用，不能静默覆盖");
    }

    const now = new Date();
    const update = await this.prisma.assessmentItem.updateMany({
      where: { id: itemId, revision: item.revision, scoredScore: null },
      data: {
        scoredScore: data.score,
        reviewerUserId: auth.principal.userId,
        ...(data.comment !== undefined ? { reviewerComment: data.comment } : {}),
        reviewedAt: now,
        status: "REVIEWED",
        revision: { increment: 1 },
      },
    });
    if (update.count !== 1) {
      const current = await this.prisma.assessmentItem.findUnique({
        where: { id: itemId },
        select: { id: true, sessionId: true, maxScore: true, scoredScore: true, reviewerUserId: true, reviewerComment: true, reviewedAt: true, revision: true, status: true, autoResult: true },
      });
      if (current?.reviewerUserId === auth.principal.userId && current.scoredScore === data.score) {
        return { item: current, report: await this.finalizeQuestionBankIfComplete(schoolId, sessionId, auth.principal.userId) };
      }
      throw new AssessmentConflictException("该题已被并发复核，请刷新后重试");
    }

    const updated = await this.prisma.assessmentItem.findUniqueOrThrow({
      where: { id: itemId },
      select: { id: true, sessionId: true, maxScore: true, scoredScore: true, reviewerUserId: true, reviewerComment: true, reviewedAt: true, revision: true, status: true, autoResult: true },
    });
    const report = await this.finalizeQuestionBankIfComplete(schoolId, sessionId, auth.principal.userId);
    return { item: updated, report };
  }

  /** Finalize the Level 1 point report only after every QB item has a score. */
  async finalizeQuestionBankIfComplete(schoolId: string, sessionId: string, generatedByUserId?: string) {
    const session = await this.sessionRepo.findByIdAndSchool(sessionId, schoolId);
    if (session && this.purposeOf(session) === "REMEDIATION") {
      return this.finalizeRemediationIfComplete(schoolId, sessionId);
    }
    if (!session || session.status === "CANCELLED" || session.status === "COMPLETED") {
      return this.reportRepo.findBySessionId(sessionId).then((report) => report ? toAssessmentReportResponse(report, { includeDiagnosis: session?.status === "COMPLETED" }) : null);
    }
    if (session.status !== "SUBMITTED" && session.status !== "PROCESSING") return null;

    await this.questionBankScoring.scoreSession(sessionId);
    const items = await this.prisma.assessmentItem.findMany({
      where: { sessionId },
      select: {
        id: true,
        questionVersionId: true,
        itemType: true,
        sortOrder: true,
        maxScore: true,
        scoredScore: true,
        questionVersion: { select: { item: { select: { domain: true, questionType: true, level: true } } } },
      },
      orderBy: { sortOrder: "asc" },
    });
    if (this.hasIncompleteQuestionBankScoring(items)) {
      if (session.status === "SUBMITTED") await this.sessionRepo.updateStatus(sessionId, "PROCESSING");
      return null;
    }
    const existing = await this.reportRepo.findBySessionId(sessionId);
    if (existing) return toAssessmentReportResponse(existing, { includeDiagnosis: true });
    if (session.status === "SUBMITTED") await this.sessionRepo.updateStatus(sessionId, "PROCESSING");

    try {
      return await this.createReportFromScoredItems({
        schoolId,
        sessionId,
        items: items.map((item) => ({
        ...item,
        domain: item.questionVersion?.item.domain ?? null,
        family: item.questionVersion?.item.questionType ?? null,
        level: item.questionVersion?.item.level ?? null,
        })),
        ...(generatedByUserId ? { generatedByUserId } : {}),
      });
    } catch (error) {
      const concurrent = await this.reportRepo.findBySessionId(sessionId);
      if (concurrent) return toAssessmentReportResponse(concurrent, { includeDiagnosis: true });
      throw error;
    }
  }

  /** Complete a fully scored remediation subset without creating a report. */
  async finalizeRemediationIfComplete(schoolId: string, sessionId: string) {
    const session = await this.sessionRepo.findByIdAndSchool(sessionId, schoolId);
    if (
      !session ||
      this.purposeOf(session) !== "REMEDIATION" ||
      session.status === "CANCELLED" ||
      session.status === "COMPLETED"
    ) {
      return null;
    }
    if (session.status !== "SUBMITTED" && session.status !== "PROCESSING") return null;

    await this.questionBankScoring.scoreSession(sessionId);
    const items = await this.prisma.assessmentItem.findMany({
      where: { sessionId },
      select: { questionVersionId: true, maxScore: true, scoredScore: true },
      orderBy: { sortOrder: "asc" },
    });
    if (this.hasIncompleteRemediationScoring(items)) {
      if (session.status === "SUBMITTED") await this.sessionRepo.updateStatus(sessionId, "PROCESSING");
      return null;
    }

    await this.sessionRepo.updateStatus(sessionId, "COMPLETED", { completedAt: new Date() } as Partial<AssessmentSession>);
    return null;
  }

  private async remediationSource(tx: any, where: Record<string, unknown>, orderBy?: Record<string, "asc" | "desc">) {
    return tx.assessmentSession.findFirst({
      where,
      ...(orderBy ? { orderBy } : {}),
      select: {
        id: true,
        enrollmentId: true,
        classId: true,
        type: true,
        status: true,
        purpose: true,
        practiceDefinitionId: true,
        practiceVersionId: true,
        deliveryId: true,
        report: { select: { summary: true } },
        items: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            questionVersionId: true,
            itemType: true,
            sectionTitle: true,
            sectionOrder: true,
            sortOrder: true,
            maxScore: true,
            scoredScore: true,
            questionVersion: {
              select: {
                id: true,
                status: true,
                deliverySpec: true,
                item: { select: { domain: true, questionType: true } },
              },
            },
          },
        },
      },
    });
  }

  /**
   * One authoritative construction path for student and teacher remediation.
   * It is intentionally given only source assessment items and validated
   * diagnosis candidates, never client question ids or answer-bearing data.
   */
  private async createOrResumeRemediationFromCandidates(tx: any, input: {
    schoolId: string;
    enrollment: { id: string; classId: string };
    actorUserId: string;
    source: any;
    origin: "SELF_INITIATED" | "TEACHER_ASSIGNED";
    focus: { mode: "ALL_RETRY" } | { mode: "FAMILY"; family: string };
    candidates: readonly QuestionBankRetryCandidate[];
  }) {
    const { schoolId, enrollment, actorUserId, source, origin, focus, candidates } = input;
    if (
      source.purpose !== "STANDARD" ||
      source.status !== "COMPLETED" ||
      !source.practiceDefinitionId ||
      !source.practiceVersionId ||
      !source.deliveryId ||
      source.enrollmentId !== enrollment.id ||
      source.classId !== enrollment.classId
    ) {
      throw new AssessmentConflictException("只有已完成的正式题库测评可以创建专项巩固练习");
    }
    if (!candidates.length) return null;

    const candidateVersionIds = candidates.map((candidate) => candidate.questionVersionId).sort();
    // PostgreSQL transaction-scoped lock makes a double-click/concurrent
    // request for this exact teacher/student/source/focus/subset serialize
    // before the active-attempt recheck. It does not lock different focuses.
    const assignmentKey = `${schoolId}:${enrollment.id}:${source.id}:${actorUserId}:${JSON.stringify(focus)}:${candidateVersionIds.join(",")}`;
    if (typeof tx.$executeRaw === "function") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${assignmentKey}))`;
    }
    const remediationOriginScope = origin === "SELF_INITIATED"
      ? { OR: [{ remediationOrigin: "SELF_INITIATED" }, { remediationOrigin: null }] }
      : { remediationOrigin: "TEACHER_ASSIGNED" };
    const active = await tx.assessmentSession.findMany({
      where: {
        schoolId,
        enrollmentId: enrollment.id,
        purpose: "REMEDIATION",
        retestOfSessionId: source.id,
        initiatorUserId: actorUserId,
        ...remediationOriginScope,
        status: { in: ["CREATED", "IN_PROGRESS", "SUBMITTED", "PROCESSING"] },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        status: true,
        remediationFocus: true,
        items: { select: { questionVersionId: true } },
      },
    });
    const focusKey = JSON.stringify(focus);
    const existing = active.find((attempt: any) => {
      const versions = attempt.items
        .map((item: { questionVersionId: string | null }) => item.questionVersionId)
        .filter((id: string | null): id is string => Boolean(id))
        .sort();
      return JSON.stringify(attempt.remediationFocus ?? { mode: "ALL_RETRY" }) === focusKey && versions.length === candidateVersionIds.length && versions.every((id: string, index: number) => id === candidateVersionIds[index]);
    });
    if (existing) {
      return {
        outcome: "RESUMED" as const,
        sourceSessionId: source.id,
        attemptId: existing.id,
        status: existing.status,
        itemCount: candidates.length,
        resumed: true,
      };
    }

    const candidateIds = new Set(candidates.map((candidate) => candidate.assessmentItemId));
    const selected = source.items.filter((item: any) => candidateIds.has(item.id));
    if (selected.length !== candidates.length) {
      throw new AssessmentConflictException("巩固题目引用与正式诊断不一致");
    }
    const attempt = await tx.assessmentSession.create({
      data: {
        schoolId,
        enrollmentId: enrollment.id,
        classId: enrollment.classId,
        initiatorUserId: actorUserId,
        type: source.type,
        purpose: "REMEDIATION",
        remediationOrigin: origin,
        remediationFocus: focus as Prisma.InputJsonValue,
        retestOfSessionId: source.id,
        practiceDefinitionId: source.practiceDefinitionId,
        practiceVersionId: source.practiceVersionId,
        deliveryId: source.deliveryId,
      },
      select: { id: true, status: true },
    });
    await tx.assessmentItem.createMany({
      data: selected.map((item: any) => {
        if (
          !item.questionVersionId ||
          !item.questionVersion ||
          item.questionVersion.status !== "PUBLISHED" ||
          item.maxScore == null ||
          !Number.isFinite(item.maxScore)
        ) {
          throw new AssessmentConflictException("巩固题目没有可用的已发布题库版本");
        }
        const deliverySpec = assertSafeQuestionDeliverySpec(item.questionVersion.deliverySpec);
        return {
          sessionId: attempt.id,
          questionVersionId: item.questionVersionId,
          prompt: deliverySpec as Prisma.InputJsonValue,
          itemConfig: deliverySpec as Prisma.InputJsonValue,
          itemType: item.itemType,
          sectionTitle: item.sectionTitle,
          sectionOrder: item.sectionOrder,
          sortOrder: item.sortOrder,
          maxScore: item.maxScore,
        };
      }),
    });
    return {
      outcome: "CREATED" as const,
      sourceSessionId: source.id,
      attemptId: attempt.id,
      status: attempt.status,
      itemCount: selected.length,
      resumed: false,
    };
  }

  private persistedDiagnosis(summary: unknown): QuestionBankDiagnosis | null {
    if (!summary || typeof summary !== "object" || Array.isArray(summary)) return null;
    const diagnosis = (summary as Record<string, unknown>).diagnosis;
    return isQuestionBankDiagnosis(diagnosis) ? diagnosis : null;
  }

  private safeRemediationFocus(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return { mode: "ALL_RETRY" as const, displayName: "全部待巩固题目" };
    const record = value as Record<string, unknown>;
    if (record.mode === "FAMILY" && typeof record.family === "string") {
      const candidate = QUESTION_BANK_FAMILY_ORDER.includes(record.family as never) ? record.family : null;
      if (candidate) {
        const displayName = QUESTION_BANK_FAMILY_ORDER.includes(candidate as never)
          ? ({
              LISTEN_IMAGE_CHOICE: "听音选图", DICTATION: "听写句子", READ_ALOUD: "朗读句子", PICTURE_SPEAKING: "看图说话",
              WORD_RECOGNITION: "单词认读", SENTENCE_COMPREHENSION: "句子理解", PICTURE_WORD: "看图写词", SENTENCE_COMPLETION: "句子补全",
            } as Record<string, string>)[candidate]!
          : "专项巩固";
        return { mode: "FAMILY" as const, family: candidate, displayName };
      }
    }
    return { mode: "ALL_RETRY" as const, displayName: "全部待巩固题目" };
  }

  /**
   * The persisted diagnosis identifies what to retry, but every database
   * reference and score is rechecked against the completed source snapshot.
   * This prevents a stale or tampered JSON blob from selecting arbitrary work.
   */
  private validatedRetryCandidates(
    candidates: readonly QuestionBankRetryCandidate[],
    sourceItems: Array<{
      id: string;
      questionVersionId: string | null;
      maxScore: number | null;
      scoredScore: number | null;
      questionVersion: { item: { domain: string | null; questionType: string | null } } | null;
    }>,
  ) {
    const byId = new Map(sourceItems.map((item) => [item.id, item]));
    const seen = new Set<string>();
    for (const candidate of candidates) {
      if (
        !candidate ||
        typeof candidate.assessmentItemId !== "string" ||
        typeof candidate.questionVersionId !== "string" ||
        typeof candidate.family !== "string" ||
        typeof candidate.domain !== "string" ||
        !Number.isFinite(candidate.earned) ||
        !Number.isFinite(candidate.max) ||
        candidate.max <= 0 ||
        candidate.earned < 0 ||
        candidate.earned >= candidate.max ||
        seen.has(candidate.assessmentItemId)
      ) {
        throw new AssessmentConflictException("巩固题目引用与正式诊断不一致");
      }
      seen.add(candidate.assessmentItemId);
      const item = byId.get(candidate.assessmentItemId);
      if (
        !item ||
        item.questionVersionId !== candidate.questionVersionId ||
        item.scoredScore == null ||
        item.maxScore == null ||
        !Number.isFinite(item.scoredScore) ||
        !Number.isFinite(item.maxScore) ||
        item.scoredScore >= item.maxScore ||
        item.scoredScore !== candidate.earned ||
        item.maxScore !== candidate.max ||
        item.questionVersion?.item.questionType !== candidate.family ||
        item.questionVersion?.item.domain !== candidate.domain
      ) {
        throw new AssessmentConflictException("巩固题目引用与正式诊断不一致");
      }
    }
    return candidates;
  }

  private purposeOf(session: Pick<AssessmentSession, "purpose"> | { purpose?: string | null }) {
    return session.purpose === "REMEDIATION" ? "REMEDIATION" : "STANDARD";
  }

  private asScoringSpecRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private assertReviewActor(auth: AuthContext, schoolId: string) {
    if (auth.tenant.schoolId !== schoolId || !auth.principal.roles.some((role) => [MembershipRole.TEACHER, MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN].includes(role))) {
      throw new AssessmentForbiddenException();
    }
  }

  private async assertReviewClass(auth: AuthContext, schoolId: string, classId: string) {
    const isAdmin = auth.principal.roles.some((role) => [MembershipRole.SCHOOL_ADMIN, MembershipRole.PLATFORM_ADMIN].includes(role));
    if (isAdmin) return;
    const teacherEnrollment = await this.prisma.enrollment.findFirst({
      where: { userId: auth.principal.userId, schoolId, classId, role: "TEACHER", status: "ACTIVE" },
      select: { id: true },
    });
    if (!teacherEnrollment) throw new AssessmentForbiddenException("您不是该测评所属班级的任课教师");
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
        purpose: true,
        practiceDefinitionId: true,
        completedAt: true,
        items: { select: { maxScore: true, scoredScore: true } },
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

    const remediationDefinitionIds = [...new Set(
      sessions
        .filter((session) => session.purpose === "REMEDIATION" && session.practiceDefinitionId)
        .map((session) => session.practiceDefinitionId as string),
    )];
    const remediationDefinitions = remediationDefinitionIds.length
      ? await this.prisma.practiceDefinition.findMany({
          where: { id: { in: remediationDefinitionIds } },
          select: { id: true, title: true },
        })
      : [];
    const remediationTitleById = new Map(remediationDefinitions.map((definition) => [definition.id, definition.title]));

    // Build history items with metric extraction
    const historyItems = sessions.map((s) => {
      const reportData = s.report;
      let metrics: Record<string, number> | null = null;
      if (s.purpose !== "REMEDIATION" && reportData) {
        metrics = {};
        if (typeof reportData.overallScore === "number") metrics.overall = reportData.overallScore;
        if (typeof reportData.readingScore === "number") metrics.reading = reportData.readingScore;
        if (typeof reportData.writtenScore === "number") metrics.written = reportData.writtenScore;
        if (!Object.keys(metrics).length && reportData.summary && typeof reportData.summary === "object") {
          metrics = Object.fromEntries(Object.entries(reportData.summary as Record<string, unknown>).filter(([, value]) => typeof value === "number")) as Record<string, number>;
        }
        if (!Object.keys(metrics).length) metrics = null;
      }
      const completeRemediationScores = s.purpose === "REMEDIATION" && s.items.length > 0 && s.items.every((item) =>
        typeof item.maxScore === "number" && Number.isFinite(item.maxScore) &&
        typeof item.scoredScore === "number" && Number.isFinite(item.scoredScore),
      );
      const remediation = completeRemediationScores
        ? (() => {
            const earnedPoints = s.items.reduce((total, item) => total + (item.scoredScore ?? 0), 0);
            const maxPoints = s.items.reduce((total, item) => total + (item.maxScore ?? 0), 0);
            return {
              title: s.practiceDefinitionId ? remediationTitleById.get(s.practiceDefinitionId) ?? "专项巩固" : "专项巩固",
              earnedPoints,
              maxPoints,
              percentage: maxPoints > 0 ? Math.round(((earnedPoints / maxPoints) * 100 + Number.EPSILON) * 100) / 100 : null,
            };
          })()
        : null;
      return {
        sessionId: s.id,
        type: s.type,
        purpose: s.purpose,
        completedAt: s.completedAt?.toISOString() ?? null,
        metrics,
        remediation,
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
