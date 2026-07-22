import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@yuzan/database";
import { PrismaService } from "../../shared/database/index.js";
import type { AuthContext } from "../../common/security/auth.types.js";

type CoursePracticeContext = { assignmentId?: string; submissionId?: string; activityId?: string };
export type PracticeCatalogQuery = {
  query?: string; abilityCategory?: string; gradeBand?: string; difficulty?: string; duration?: string;
  itemType?: string; cultureTag?: string; mode?: string; requiresRecording?: string; instantFeedback?: string; catalogType?: string; completionStatus?: string; sort?: string; cursor?: string;
};

const OPEN_ATTEMPT_STATUSES = ["CREATED", "IN_PROGRESS"] as const;

@Injectable()
export class PracticeService {
  constructor(private readonly prisma: PrismaService) {}

  async listForStudent(auth: AuthContext, schoolId: string, query: PracticeCatalogQuery = {}) {
    this.assertStudentTenant(auth, schoolId);
    const enrollment = await this.activeEnrollment(auth, schoolId);
    const deliveries = await this.prisma.practiceDelivery.findMany({
      where: {
        schoolId,
        status: "OPEN",
        OR: [{ studentId: auth.principal.userId }, { studentId: null, classId: enrollment.classId }],
        AND: [{ OR: [{ deadline: null }, { deadline: { gte: new Date() } }] }],
      },
      include: {
        practiceVersion: { include: { definition: true, sections: { include: { items: true }, orderBy: { sortOrder: "asc" } } } },
      },
      orderBy: { createdAt: "asc" },
    });

    const attempts = await this.prisma.assessmentSession.findMany({
      where: { schoolId, enrollmentId: enrollment.id, courseSubmissionId: null, practiceDefinitionId: { not: null } },
      select: { id: true, practiceDefinitionId: true, deliveryId: true, status: true, updatedAt: true, completedAt: true, report: { select: { overallScore: true, readingScore: true, writtenScore: true } } },
      orderBy: { updatedAt: "desc" },
    });
    const favorites = await this.prisma.practiceFavorite.findMany({ where: { schoolId, studentId: auth.principal.userId }, select: { definitionId: true } });
    const favoriteIds = new Set(favorites.map((favorite) => favorite.definitionId));
    const byDefinition = new Map<string, typeof attempts>();
    for (const attempt of attempts) {
      if (!attempt.practiceDefinitionId) continue;
      const list = byDefinition.get(attempt.practiceDefinitionId) ?? [];
      list.push(attempt);
      byDefinition.set(attempt.practiceDefinitionId, list);
    }
    const allEntries = deliveries.map((delivery) => this.catalogEntry(delivery, byDefinition.get(delivery.practiceVersion.definitionId) ?? [], favoriteIds.has(delivery.practiceVersion.definitionId)));
    this.applyRecommendationRules(allEntries, attempts);
    const filtered = allEntries.filter((entry) => this.matchesCatalogQuery(entry, query));
    const sorted = this.sortCatalog(filtered, query.sort);
    const offset = Math.max(0, Number.parseInt(query.cursor ?? "0", 10) || 0);
    const pageSize = 12;
    const items = sorted.slice(offset, offset + pageSize);
    return {
      items,
      facets: this.catalogFacets(allEntries),
      nextCursor: offset + pageSize < sorted.length ? String(offset + pageSize) : null,
      total: sorted.length,
      availableCount: allEntries.length,
    };
  }

  async getDetail(auth: AuthContext, schoolId: string, definitionId: string) {
    this.assertStudentTenant(auth, schoolId);
    const enrollment = await this.activeEnrollment(auth, schoolId);
    const delivery = await this.findVisibleDelivery(schoolId, definitionId, enrollment.classId, auth.principal.userId);
    if (!delivery) throw new NotFoundException("练习不存在或暂未向你开放");
    const attempts = await this.prisma.assessmentSession.findMany({
      where: { schoolId, enrollmentId: enrollment.id, deliveryId: delivery.id, courseSubmissionId: null },
      select: { id: true, practiceDefinitionId: true, deliveryId: true, status: true, updatedAt: true, completedAt: true, report: { select: { overallScore: true, readingScore: true, writtenScore: true } } },
      orderBy: { updatedAt: "desc" },
    });
    const isFavorite = await this.prisma.practiceFavorite.findUnique({ where: { schoolId_studentId_definitionId: { schoolId, studentId: auth.principal.userId, definitionId } }, select: { id: true } });
    const entry = this.catalogEntry(delivery, attempts, Boolean(isFavorite));
    this.applyRecommendationRules([entry], attempts);
    return {
      ...entry,
      sections: delivery.practiceVersion.sections.map((section) => ({
        title: section.title,
        description: section.description,
        estimatedMinutes: section.estimatedMinutes,
        itemCount: section.items.length,
      })),
      reRecordPolicy: delivery.reRecordPolicy,
      mobilePolicy: delivery.mobilePolicy,
      oralItemCount: delivery.practiceVersion.sections.flatMap((section) => section.items).filter((item) => ["READING", "SPEECH", "LISTEN_REPEAT", "READ_ALOUD"].includes(item.itemType)).length,
      writtenItemCount: delivery.practiceVersion.sections.flatMap((section) => section.items).filter((item) => ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "SHORT_ANSWER", "LISTEN_RETELL", "WRITTEN", "CHOICE", "FILL_BLANK"].includes(item.itemType)).length,
      scoringDisclosure: "录音将进入自动分析和教师复核；服务不可用时会如实显示处理中或不可用，不生成虚假分数。",
    };
  }

  async addFavorite(auth: AuthContext, schoolId: string, definitionId: string) {
    this.assertStudentTenant(auth, schoolId);
    const enrollment = await this.activeEnrollment(auth, schoolId);
    const visible = await this.findVisibleDelivery(schoolId, definitionId, enrollment.classId, auth.principal.userId);
    if (!visible) throw new NotFoundException("练习不存在或暂未向你开放");
    await this.prisma.practiceFavorite.upsert({ where: { schoolId_studentId_definitionId: { schoolId, studentId: auth.principal.userId, definitionId } }, update: {}, create: { schoolId, studentId: auth.principal.userId, definitionId } });
    return { favorite: true };
  }

  async removeFavorite(auth: AuthContext, schoolId: string, definitionId: string) {
    this.assertStudentTenant(auth, schoolId);
    await this.prisma.practiceFavorite.deleteMany({ where: { schoolId, studentId: auth.principal.userId, definitionId } });
    return { favorite: false };
  }

  async createOrResume(auth: AuthContext, schoolId: string, definitionId: string, context: CoursePracticeContext = {}) {
    this.assertStudentTenant(auth, schoolId);
    const enrollment = await this.activeEnrollment(auth, schoolId);
    const result = await this.prisma.$transaction(async (tx) => {
      const delivery = await tx.practiceDelivery.findFirst({
        where: {
          schoolId,
          status: "OPEN",
          practiceVersion: { definitionId, status: "PUBLISHED", definition: { status: "PUBLISHED" } },
          OR: [{ studentId: auth.principal.userId }, { studentId: null, classId: enrollment.classId }],
          AND: [{ OR: [{ deadline: null }, { deadline: { gte: new Date() } }] }],
        },
        include: {
          practiceVersion: { include: { sections: { include: { items: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } } } },
        },
      });
      if (!delivery) throw new NotFoundException("没有可用的练习投放");

      const courseContext = await this.validateCourseContext(tx, schoolId, enrollment.id, definitionId, context);

      const existing = await tx.assessmentSession.findFirst({
        where: {
          schoolId,
          enrollmentId: enrollment.id,
          deliveryId: delivery.id,
          courseActivityId: courseContext?.activityId ?? null,
          courseSubmissionId: courseContext?.submissionId ?? null,
          status: { in: [...OPEN_ATTEMPT_STATUSES] },
        },
        orderBy: { updatedAt: "desc" },
      });
      if (existing) return { attempt: existing, resumed: true };

      const snapshot = delivery.practiceVersion.sections.flatMap((section) =>
        section.items.map((item) => ({ section, item })),
      );
      if (snapshot.length === 0) throw new BadRequestException("已发布练习没有可执行题目");

      const attempt = await tx.assessmentSession.create({
        data: {
          schoolId,
          enrollmentId: enrollment.id,
          classId: enrollment.classId,
          initiatorUserId: auth.principal.userId,
          type: "MIXED",
          practiceDefinitionId: definitionId,
          practiceVersionId: delivery.practiceVersionId,
          deliveryId: delivery.id,
          ...(courseContext ? { courseActivityId: courseContext.activityId, courseSubmissionId: courseContext.submissionId } : {}),
        },
      });
      await tx.assessmentItem.createMany({
        data: snapshot.map(({ section, item }, index) => ({
          sessionId: attempt.id,
          // PracticeItemRef preserves the authored question reference, while
          // AssessmentItem is a self-contained execution snapshot. Do not
          // attach an unscoped legacy Question FK here: the copied config is
          // the immutable runtime source and remains valid after content moves.
          questionId: null,
          prompt: item.config as Prisma.InputJsonValue,
          itemConfig: item.config as Prisma.InputJsonValue,
          itemType: item.itemType,
          sectionTitle: section.title,
          sectionOrder: section.sortOrder,
          sortOrder: index + 1,
          maxScore: typeof (item.config as Record<string, unknown>).maxScore === "number" ? Number((item.config as Record<string, unknown>).maxScore) : null,
        })),
      });
      return { attempt, resumed: false };
    });
    return {
      attemptId: result.attempt.id,
      status: result.attempt.status,
      resumed: result.resumed,
      mode: result.attempt.courseSubmissionId ? "COURSE_PRACTICE" : "SELF_PRACTICE",
      courseContext: result.attempt.courseSubmissionId ? { submissionId: result.attempt.courseSubmissionId, activityId: result.attempt.courseActivityId } : null,
    };
  }

  private async validateCourseContext(tx: Prisma.TransactionClient, schoolId: string, enrollmentId: string, definitionId: string, context: CoursePracticeContext) {
    const values = [context.assignmentId, context.submissionId, context.activityId];
    if (values.every((value) => !value)) return null;
    if (values.some((value) => !value)) throw new BadRequestException("课程练习上下文必须同时包含 assignmentId、submissionId 和 activityId");
    const assignmentId = context.assignmentId!;
    const submissionId = context.submissionId!;
    const activityId = context.activityId!;
    const submission = await tx.submission.findFirst({ where: { id: submissionId, schoolId, assignmentId, enrollmentId, deletedAt: null, status: { in: ["IN_PROGRESS", "PENDING_SYNC"] } }, select: { id: true } });
    if (!submission) throw new ForbiddenException("课程 Submission 不存在或不属于当前学生");
    const reference = await tx.courseActivityPractice.findFirst({
      where: { schoolId, activityId, practiceDefinitionId: definitionId, activity: { lesson: { unit: { courseVersion: { assignments: { some: { id: assignmentId, schoolId } } } } } } },
      select: { activityId: true },
    });
    if (!reference) throw new ForbiddenException("该练习未被当前课程活动引用");
    return { assignmentId, submissionId, activityId: reference.activityId };
  }

  async getAttempt(auth: AuthContext, schoolId: string, attemptId: string) {
    this.assertStudentTenant(auth, schoolId);
    const enrollment = await this.activeEnrollment(auth, schoolId);
    const attempt = await this.prisma.assessmentSession.findFirst({ where: { id: attemptId, schoolId, enrollmentId: enrollment.id } });
    if (!attempt || !attempt.practiceDefinitionId) throw new NotFoundException("练习 Attempt 不存在");
    return attempt;
  }

  async getAttemptItems(auth: AuthContext, schoolId: string, attemptId: string) {
    await this.getAttempt(auth, schoolId, attemptId);
    return this.prisma.assessmentItem.findMany({
      where: { sessionId: attemptId },
      select: { id: true, itemType: true, prompt: true, itemConfig: true, sectionTitle: true, sectionOrder: true, sortOrder: true, status: true, recordingId: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  private async activeEnrollment(auth: AuthContext, schoolId: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { schoolId, userId: auth.principal.userId, role: "STUDENT", status: "ACTIVE" },
      select: { id: true, classId: true },
    });
    if (!enrollment) throw new ForbiddenException("当前用户没有有效的学生班级关系");
    return enrollment;
  }

  private async findVisibleDelivery(schoolId: string, definitionId: string, classId: string, studentId: string) {
    return this.prisma.practiceDelivery.findFirst({
      where: {
        schoolId,
        status: "OPEN",
        practiceVersion: { definitionId, status: "PUBLISHED", definition: { status: "PUBLISHED" } },
        OR: [{ studentId }, { studentId: null, classId }],
        AND: [{ OR: [{ deadline: null }, { deadline: { gte: new Date() } }] }],
      },
      include: { practiceVersion: { include: { definition: true, sections: { include: { items: true }, orderBy: { sortOrder: "asc" } } } } },
    });
  }

  private catalogEntry(delivery: any, attempts: Array<{ id: string; status: string; updatedAt: Date; completedAt?: Date | null; report?: { overallScore: number | null; readingScore: number | null; writtenScore: number | null } | null }>, favorite: boolean) {
    const { definition } = delivery.practiceVersion;
    const openAttempt = attempts.find((attempt) => OPEN_ATTEMPT_STATUSES.includes(attempt.status as typeof OPEN_ATTEMPT_STATUSES[number])) ?? null;
    const completedAttempt = attempts.find((attempt) => attempt.status === "COMPLETED") ?? null;
    const completionStatus = openAttempt ? "IN_PROGRESS" : completedAttempt ? "COMPLETED" : "NOT_STARTED";
    const itemTypes = [...new Set(delivery.practiceVersion.sections.flatMap((section: any) => section.items.map((item: any) => item.itemType)))];
    const recommendationReason = openAttempt
      ? "你有一项未完成的练习，建议从上次进度继续。"
      : delivery.mode === "ASSIGNMENT"
        ? "教师已向你的班级开放这项练习。"
        : completedAttempt
          ? "已完成基础练习，适合作为下一轮巩固。"
          : "根据你的当前学习阶段推荐。";
    return {
      id: definition.id,
      title: definition.title,
      summary: definition.summary,
      coverAsset: definition.coverAsset,
      difficulty: definition.difficulty,
      estimatedMinutes: definition.estimatedMinutes,
      gradeBand: definition.gradeBand,
      abilityCategories: definition.abilityCategories,
      cultureTags: definition.cultureTags,
      catalogType: definition.catalogType,
      requiresRecording: definition.requiresRecording,
      instantFeedback: definition.instantFeedback,
      mode: delivery.mode,
      deadline: delivery.deadline?.toISOString() ?? null,
      sectionCount: delivery.practiceVersion.sections.length,
      itemTypes,
      studentState: {
        completionStatus,
        favorite,
        attempt: openAttempt ? { status: openAttempt.status, updatedAt: openAttempt.updatedAt.toISOString() } : null,
        lastCompletedAt: completedAttempt?.completedAt?.toISOString() ?? null,
        recentResult: completedAttempt?.report ? { overallScore: completedAttempt.report.overallScore, readingScore: completedAttempt.report.readingScore, writtenScore: completedAttempt.report.writtenScore } : null,
      },
      recommendationReason,
    };
  }

  private matchesCatalogQuery(entry: any, query: PracticeCatalogQuery) {
    const normalizedQuery = query.query?.trim().toLocaleLowerCase();
    if (normalizedQuery && !`${entry.title} ${entry.summary} ${entry.abilityCategories.join(" ")} ${entry.cultureTags.join(" ")}`.toLocaleLowerCase().includes(normalizedQuery)) return false;
    if (query.abilityCategory && !entry.abilityCategories.includes(query.abilityCategory)) return false;
    if (query.gradeBand && entry.gradeBand !== query.gradeBand) return false;
    if (query.difficulty && entry.difficulty !== query.difficulty) return false;
    if (query.itemType && !entry.itemTypes.includes(query.itemType)) return false;
    if (query.cultureTag && !entry.cultureTags.includes(query.cultureTag)) return false;
    if (query.mode && entry.mode !== query.mode) return false;
    if (query.requiresRecording && String(entry.requiresRecording) !== query.requiresRecording) return false;
    if (query.instantFeedback && String(entry.instantFeedback) !== query.instantFeedback) return false;
    if (query.catalogType && entry.catalogType !== query.catalogType) return false;
    if (query.completionStatus === "FAVORITE" && !entry.studentState.favorite) return false;
    if (query.completionStatus && query.completionStatus !== "FAVORITE" && entry.studentState.completionStatus !== query.completionStatus) return false;
    if (query.duration === "SHORT" && entry.estimatedMinutes > 10) return false;
    if (query.duration === "MEDIUM" && (entry.estimatedMinutes < 11 || entry.estimatedMinutes > 20)) return false;
    if (query.duration === "LONG" && entry.estimatedMinutes < 21) return false;
    return true;
  }

  private sortCatalog(entries: any[], sort?: string) {
    return [...entries].sort((a, b) => {
      if (sort === "DURATION_ASC") return a.estimatedMinutes - b.estimatedMinutes || a.title.localeCompare(b.title, "zh-CN");
      if (sort === "DURATION_DESC") return b.estimatedMinutes - a.estimatedMinutes || a.title.localeCompare(b.title, "zh-CN");
      if (sort === "TITLE") return a.title.localeCompare(b.title, "zh-CN");
      if (sort === "RECOMMENDED") return b.recommendationRank - a.recommendationRank || a.estimatedMinutes - b.estimatedMinutes || a.title.localeCompare(b.title, "zh-CN");
      return Number(b.mode === "ASSIGNMENT") - Number(a.mode === "ASSIGNMENT") || a.title.localeCompare(b.title, "zh-CN");
    });
  }

  private catalogFacets(entries: any[]) {
    const countValues = (values: string[]) => Object.entries(values.reduce<Record<string, number>>((counts, value) => { counts[value] = (counts[value] ?? 0) + 1; return counts; }, {})).map(([value, count]) => ({ value, count }));
    return {
      abilityCategory: countValues(entries.flatMap((entry) => entry.abilityCategories)),
      gradeBand: countValues(entries.map((entry) => entry.gradeBand)),
      difficulty: countValues(entries.map((entry) => entry.difficulty)),
      itemType: countValues(entries.flatMap((entry) => entry.itemTypes)),
      cultureTag: countValues(entries.flatMap((entry) => entry.cultureTags)),
      mode: countValues(entries.map((entry) => entry.mode)),
      requiresRecording: countValues(entries.map((entry) => String(entry.requiresRecording))),
      instantFeedback: countValues(entries.map((entry) => String(entry.instantFeedback))),
      duration: ["SHORT", "MEDIUM", "LONG"].map((value) => ({ value, count: entries.filter((entry) => this.matchesCatalogQuery(entry, { duration: value })).length })),
      completionStatus: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "FAVORITE"].map((value) => ({ value, count: entries.filter((entry) => this.matchesCatalogQuery(entry, { completionStatus: value })).length })),
    };
  }

  // P0 deliberately uses stable, explainable rules instead of a random daily
  // feed. Once reports expose richer dimensions this mapper can grow without
  // changing the catalogue page or the reusable executor.
  private applyRecommendationRules(entries: any[], attempts: Array<{ status: string; updatedAt: Date; completedAt?: Date | null; report?: { overallScore: number | null; readingScore: number | null; writtenScore: number | null } | null }>) {
    const latestReport = attempts.filter((attempt) => attempt.report).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]?.report ?? null;
    const weakDimension = latestReport
      ? ([
        ["阅读理解", latestReport.readingScore], ["书面表达", latestReport.writtenScore], ["独立朗读", latestReport.overallScore],
      ] as const).filter(([, score]) => typeof score === "number" && score < 60).sort((a, b) => Number(a[1]) - Number(b[1]))[0]?.[0] ?? null
      : null;
    const difficultyRank: Record<string, number> = { "入门": 1, "基础": 2, "基础巩固": 2, "进阶": 3, "挑战": 4 };
    const completedRanks = entries.filter((entry) => entry.studentState.completionStatus === "COMPLETED").map((entry) => difficultyRank[entry.difficulty] ?? 0);
    const highestCompletedRank = completedRanks.length ? Math.max(...completedRanks) : 0;
    const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    for (const entry of entries) {
      if (entry.studentState.completionStatus === "IN_PROGRESS") {
        entry.recommendationReason = "你有一项未完成的练习，建议从上次进度继续。";
        entry.recommendationRank = 100;
      } else if (entry.mode === "ASSIGNMENT") {
        entry.recommendationReason = "教师已向你的班级开放这项练习。";
        entry.recommendationRank = 90;
      } else if (weakDimension && entry.abilityCategories.includes(weakDimension)) {
        entry.recommendationReason = `最近报告提示“${weakDimension}”仍可加强，建议先练这一项。`;
        entry.recommendationRank = 80;
      } else if (highestCompletedRank && (difficultyRank[entry.difficulty] ?? 0) > highestCompletedRank) {
        entry.recommendationReason = "你已完成当前难度的练习，可以尝试下一难度。";
        entry.recommendationRank = 70;
      } else if (entry.studentState.completionStatus === "COMPLETED") {
        entry.recommendationReason = "已完成的练习会保留在练习库和历史中，近期不会重复优先推荐。";
        entry.recommendationRank = entry.studentState.lastCompletedAt && new Date(entry.studentState.lastCompletedAt).getTime() > fourteenDaysAgo ? 5 : 20;
      } else {
        entry.recommendationReason = "根据你的当前学习阶段推荐。";
        entry.recommendationRank = 50;
      }
    }
  }

  private assertStudentTenant(auth: AuthContext, schoolId: string) {
    if (auth.tenant.schoolId !== schoolId || !auth.principal.roles.includes("STUDENT" as any)) {
      throw new ForbiddenException("无权访问该学校的学生练习");
    }
  }
}
