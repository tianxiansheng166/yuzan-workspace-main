import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import type { Prisma } from "@yuzan/database";
import type { AuthContext } from "../../common/security/auth.types.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import type { CreateStudentActivityNoteDto, ListStudentCoursesQueryDto, SaveActivityAttemptDto, SaveStudentActivityNoteDto, UpdateStudentActivityNoteDto } from "./dto/student-course.dto.js";

const ACTIVE_SUBMISSION_STATUSES = ["IN_PROGRESS", "PENDING_SYNC", "SUBMITTED", "PROCESSING", "NEEDS_REVIEW", "REVIEWED", "ACCEPTED"] as const;
const FINISHED_PRACTICE_STATUSES = ["SUBMITTED", "PROCESSING", "COMPLETED"] as const;

@Injectable()
export class StudentCoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(auth: AuthContext, schoolId: string, filters: ListStudentCoursesQueryDto = {}) {
    const enrollment = await this.studentEnrollment(auth, schoolId);
    const limit = filters.limit ?? 20;

    const cvWhere: Prisma.CourseVersionWhereInput = {
      status: "PUBLISHED",
      publishedAt: { not: null },
      retiredAt: null,
      capabilityTheme: { not: null },
      ...(filters.capabilityTheme ? { capabilityTheme: filters.capabilityTheme } : {}),
      ...(filters.gradeBand ? { gradeBand: filters.gradeBand } : {}),
      ...(filters.difficulty ? { difficulty: filters.difficulty } : {}),
      ...(filters.search ? { title: { contains: filters.search, mode: "insensitive" } } : {}),
      ...(filters.taskGroup ? { taskGroups: { array_contains: filters.taskGroup } } : {}),
      ...(filters.culturalElement ? { culturalElements: { array_contains: filters.culturalElement } } : {}),
    };

    const assignmentWhere: Prisma.AssignmentWhereInput = {
      schoolId,
      status: "OPEN",
      deletedAt: null,
      ...(filters.source ? { source: filters.source } : {}),
      courseVersion: cvWhere,
      targets: { some: { OR: [{ enrollmentId: enrollment.id }, { classId: enrollment.classId }] } },
    };

    if (filters.cursor) {
      const cursorAssignment = await this.prisma.assignment.findFirst({ where: { ...assignmentWhere, id: filters.cursor }, select: { id: true } });
      if (cursorAssignment) {
        // `cursor` is a top-level Prisma findMany option. Keeping it out of
        // `where` prevents an invalid runtime query and keeps count accurate.
      } else {
        throw new NotFoundException("课程分页游标无效或不可访问");
      }
    }

    const direction = filters.sortOrder === "asc" ? "asc" : "desc";
    const orderBy: Prisma.AssignmentOrderByWithRelationInput[] = filters.sortBy === "publishedAt"
      ? [{ courseVersion: { publishedAt: direction } }, { id: direction }]
      : filters.sortBy === "popularity"
        ? [{ submissions: { _count: direction } }, { id: direction }]
        : [{ createdAt: direction }, { id: direction }];

    const [assignments, total] = await Promise.all([
      this.prisma.assignment.findMany({
        where: assignmentWhere,
        include: {
          courseVersion: {
            include: {
              course: { select: { id: true, title: true } },
              units: { include: { lessons: { include: { activities: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } },
              favorites: { where: { enrollmentId: enrollment.id }, select: { id: true } },
            },
          },
          submissions: { where: { enrollmentId: enrollment.id, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy,
        ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
        take: limit + 1,
      }),
      this.prisma.assignment.count({ where: assignmentWhere }),
    ]);

    const hasMore = assignments.length > limit;
    const sliced = hasMore ? assignments.slice(0, limit) : assignments;

    const items = [];
    for (const assignment of sliced) {
      const activities = assignment.courseVersion.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities));
      const completion = await this.completionFor(enrollment.id, assignment.id, assignment.courseVersionId, assignment.submissions[0]?.id);
      const status = this.catalogStatus(assignment.submissions[0]?.status, completion.progressPercent, completion.attainmentStatus);
      if (filters.status && status !== filters.status) continue;
      const nextActivity = activities.find((activity) => !completion.completedActivityIds.includes(activity.id)) ?? null;
      items.push({
        assignmentId: assignment.id,
        course: assignment.courseVersion.course,
        title: assignment.courseVersion.title,
        description: assignment.courseVersion.description,
        capabilityTheme: assignment.courseVersion.capabilityTheme,
        gradeBand: assignment.courseVersion.gradeBand,
        difficulty: assignment.courseVersion.difficulty,
        estimatedMinutes: assignment.courseVersion.estimatedMinutes,
        coverAsset: assignment.courseVersion.coverAsset,
        taskGroups: assignment.courseVersion.taskGroups,
        culturalElements: assignment.courseVersion.culturalElements,
        source: assignment.source,
        status,
        progressPercent: completion.progressPercent,
        isFavorite: assignment.courseVersion.favorites.length > 0,
        nextActivity: nextActivity ? { id: nextActivity.id, title: nextActivity.title, type: nextActivity.type } : null,
        submission: assignment.submissions[0] ? this.submissionSummary(assignment.submissions[0]) : null,
        completedAt: assignment.submissions[0]?.submittedAt?.toISOString() ?? null,
      });
    }

    const distinctThemes = await this.prisma.courseVersion.findMany({
      where: { schoolId, status: "PUBLISHED", retiredAt: null, capabilityTheme: { not: null } },
      select: { capabilityTheme: true },
      distinct: ["capabilityTheme"],
    });
    const distinctGrades = await this.prisma.courseVersion.findMany({
      where: { schoolId, status: "PUBLISHED", retiredAt: null, gradeBand: { not: null } },
      select: { gradeBand: true },
      distinct: ["gradeBand"],
    });
    const distinctDifficulties = await this.prisma.courseVersion.findMany({
      where: { schoolId, status: "PUBLISHED", retiredAt: null, difficulty: { not: null } },
      select: { difficulty: true },
      distinct: ["difficulty"],
    });

    return {
      categories: distinctThemes.map((r) => r.capabilityTheme).filter(Boolean) as string[],
      gradeBands: distinctGrades.map((r) => r.gradeBand).filter(Boolean) as string[],
      difficulties: distinctDifficulties.map((r) => r.difficulty).filter(Boolean) as string[],
      statuses: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "RESULT_PENDING"],
      sources: ["TEACHER_ASSIGNED", "RECOMMENDED", "SELF_STUDY"],
      courses: items,
      total,
      hasMore,
      nextCursor: hasMore && sliced.length > 0 ? sliced[sliced.length - 1]!.id : null,
    };
  }

  async detail(auth: AuthContext, schoolId: string, assignmentId: string) {
    const enrollment = await this.studentEnrollment(auth, schoolId);
    const assignment = await this.visibleAssignment(schoolId, assignmentId, enrollment);
    const submission = await this.prisma.submission.findFirst({ where: { schoolId, assignmentId, enrollmentId: enrollment.id, deletedAt: null }, orderBy: { createdAt: "desc" } });
    const completion = await this.completionFor(enrollment.id, assignmentId, assignment.courseVersionId, submission?.id);

    // Fetch student's personal notes for all activities in this course
    const activityIds = assignment.courseVersion.units.flatMap((u) => u.lessons.flatMap((l) => l.activities.map((a) => a.id)));
    const personalNotes = await this.prisma.studentActivityNote.findMany({
      where: { schoolId, enrollmentId: enrollment.id, activityId: { in: activityIds } },
      orderBy: [{ videoTimestamp: "asc" }, { createdAt: "asc" }],
      select: { id: true, activityId: true, content: true, videoTimestamp: true, revision: true, createdAt: true, updatedAt: true },
    });
    const notesByActivity = new Map<string, typeof personalNotes>();
    for (const note of personalNotes) {
      const list = notesByActivity.get(note.activityId) ?? [];
      list.push(note);
      notesByActivity.set(note.activityId, list);
    }

    const units = assignment.courseVersion.units.map((unit) => ({
      id: unit.id,
      title: unit.title,
      sortOrder: unit.sortOrder,
      lessons: unit.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        sortOrder: lesson.sortOrder,
        activities: lesson.activities.map((activity) => ({
          id: activity.id,
          type: activity.type,
          title: activity.title,
          instruction: activity.instruction,
          content: activity.content,
          required: activity.required,
          completionRule: activity.completionRule,
          studentNotes: this.publishedStudentNotes(activity.studentNotes),
          personalNotes: notesByActivity.get(activity.id) ?? [],
          resources: activity.resources.map((link) => ({ purpose: link.purpose, meta: link.meta, resource: { ...link.resource, byteSize: String(link.resource.byteSize) } })),
          progress: activity.progress[0] ?? null,
          attempt: activity.attempts[0] ?? null,
          practiceReference: activity.coursePractice ? { practiceDefinitionId: activity.coursePractice.practiceDefinitionId, title: activity.coursePractice.practiceDefinition.title, required: activity.coursePractice.required } : null,
        })),
      })),
    }));
    const activities = units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities));
    const nextActivity = activities.find((activity) => !activity.progress?.completed) ?? null;
    return {
      assignment: { id: assignment.id, title: assignment.title, source: assignment.source, startsAt: assignment.startsAt, dueAt: assignment.dueAt, completionRule: assignment.completionRule },
      course: assignment.courseVersion.course,
      courseVersion: {
        id: assignment.courseVersion.id,
        version: assignment.courseVersion.version,
        status: assignment.courseVersion.status,
        title: assignment.courseVersion.title,
        description: assignment.courseVersion.description,
        gradeBand: assignment.courseVersion.gradeBand,
        objectives: assignment.courseVersion.objectives,
        capabilityTheme: assignment.courseVersion.capabilityTheme,
        difficulty: assignment.courseVersion.difficulty,
        estimatedMinutes: assignment.courseVersion.estimatedMinutes,
        coverAsset: assignment.courseVersion.coverAsset,
        deviceRequirements: assignment.courseVersion.deviceRequirements,
      },
      units,
      resources: units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities.flatMap((activity) => activity.resources))),
      studentProgress: completion,
      existingSubmission: submission ? this.submissionSummary(submission) : null,
      nextActivity: nextActivity ? { id: nextActivity.id, title: nextActivity.title, type: nextActivity.type } : null,
      courseCompletion: completion,
      practiceReferences: activities.flatMap((activity) => activity.practiceReference ? [{ activityId: activity.id, ...activity.practiceReference }] : []),
    };
  }

  async createOrResumeSubmission(auth: AuthContext, schoolId: string, assignmentId: string) {
    const enrollment = await this.studentEnrollment(auth, schoolId);
    await this.visibleAssignment(schoolId, assignmentId, enrollment);
    const existing = await this.prisma.submission.findFirst({
      where: { schoolId, assignmentId, enrollmentId: enrollment.id, deletedAt: null, status: { in: [...ACTIVE_SUBMISSION_STATUSES] } },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return { submission: this.submissionSummary(existing), resumed: true };

    const latest = await this.prisma.submission.aggregate({ where: { assignmentId, enrollmentId: enrollment.id }, _max: { attemptNo: true } });
    const attemptNo = (latest._max.attemptNo ?? 0) + 1;
    const created = await this.prisma.submission.create({
      data: { schoolId, assignmentId, enrollmentId: enrollment.id, attemptNo, status: "IN_PROGRESS", idempotencyKey: `course:${assignmentId}:${attemptNo}`, revision: 0 },
    });
    return { submission: this.submissionSummary(created), resumed: false };
  }

  async saveActivityAttempt(auth: AuthContext, schoolId: string, assignmentId: string, submissionId: string, activityId: string, body: SaveActivityAttemptDto) {
    const context = await this.activityContext(auth, schoolId, assignmentId, submissionId, activityId);
    const result = await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.activityAttempt.upsert({
        where: { submissionId_activityId: { submissionId, activityId } },
        update: { kind: body.kind, value: (body.value ?? {}) as Prisma.InputJsonValue },
        create: { schoolId, submissionId, activityId, kind: body.kind, value: (body.value ?? {}) as Prisma.InputJsonValue },
      });
      const current = await tx.activityProgress.findUnique({ where: { activityId_enrollmentId: { activityId, enrollmentId: context.enrollment.id } } });
      if (body.expectedProgressRevision != null && current && current.revision !== body.expectedProgressRevision) throw new ConflictException("学习进度已在其他页面更新，请刷新后重试");
      const resolvedPosition = body.videoPosition != null ? body.videoPosition : (body.completed === false ? 0.5 : 1);
      const resolvedCompleted = body.completed !== undefined ? body.completed !== false : (body.videoPosition != null ? body.videoPosition >= 1 : true);
      const progress = await tx.activityProgress.upsert({
        where: { activityId_enrollmentId: { activityId, enrollmentId: context.enrollment.id } },
        update: { position: resolvedPosition, completed: resolvedCompleted, revision: { increment: 1 } },
        create: { schoolId, activityId, enrollmentId: context.enrollment.id, position: resolvedPosition, completed: resolvedCompleted },
      });
      return { attempt, progress };
    });
    return { ...result, courseCompletion: await this.completionFor(context.enrollment.id, assignmentId, context.assignment.courseVersionId, submissionId) };
  }

  async linkRecording(auth: AuthContext, schoolId: string, assignmentId: string, submissionId: string, activityId: string, recordingId: string) {
    const context = await this.activityContext(auth, schoolId, assignmentId, submissionId, activityId);
    if (context.activity.type !== "SPEECH") throw new UnprocessableEntityException("当前活动不是口语活动");
    const recording = await this.prisma.recording.findFirst({ where: { id: recordingId, schoolId, enrollmentId: context.enrollment.id, submissionId } });
    if (!recording) throw new NotFoundException("录音不存在或不属于当前课程提交");
    if (!["COMPLETE", "PROCESSING", "READY"].includes(recording.status)) throw new ConflictException("录音尚未完成上传，不能标记为已同步");

    const attempt = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.activityAttempt.upsert({
        where: { submissionId_activityId: { submissionId, activityId } },
        update: { kind: "SPEECH", value: { recordingId, status: recording.status } },
        create: { schoolId, submissionId, activityId, kind: "SPEECH", value: { recordingId, status: recording.status } },
      });
      await tx.recording.update({ where: { id: recordingId }, data: { activityAttemptId: saved.id } });
      await tx.speechJob.updateMany({ where: { recordingId, schoolId }, data: { submissionId } });
      await tx.activityProgress.upsert({
        where: { activityId_enrollmentId: { activityId, enrollmentId: context.enrollment.id } },
        update: { position: 1, completed: true, revision: { increment: 1 } },
        create: { schoolId, activityId, enrollmentId: context.enrollment.id, position: 1, completed: true },
      });
      return saved;
    });
    return { attempt, recordingId, synced: true, courseCompletion: await this.completionFor(context.enrollment.id, assignmentId, context.assignment.courseVersionId, submissionId) };
  }

  async completePractice(auth: AuthContext, schoolId: string, assignmentId: string, submissionId: string, activityId: string, attemptId: string) {
    const context = await this.activityContext(auth, schoolId, assignmentId, submissionId, activityId);
    const practiceReference = context.activity.coursePractice;
    if (!practiceReference) throw new UnprocessableEntityException("当前活动没有关联课程练习");
    const practiceAttempt = await this.prisma.assessmentSession.findFirst({
      where: {
        id: attemptId,
        schoolId,
        enrollmentId: context.enrollment.id,
        courseSubmissionId: submissionId,
        courseActivityId: activityId,
        practiceDefinitionId: practiceReference.practiceDefinitionId,
        status: { in: [...FINISHED_PRACTICE_STATUSES] },
      },
      select: { id: true, status: true },
    });
    if (!practiceAttempt) throw new ConflictException("课程练习尚未提交，不能完成当前活动");
    const result = await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.activityAttempt.upsert({
        where: { submissionId_activityId: { submissionId, activityId } },
        update: { kind: "COURSE_PRACTICE", value: { practiceAttemptId: attemptId, status: practiceAttempt.status } },
        create: { schoolId, submissionId, activityId, kind: "COURSE_PRACTICE", value: { practiceAttemptId: attemptId, status: practiceAttempt.status } },
      });
      const progress = await tx.activityProgress.upsert({
        where: { activityId_enrollmentId: { activityId, enrollmentId: context.enrollment.id } },
        update: { position: 1, completed: true, revision: { increment: 1 } },
        create: { schoolId, activityId, enrollmentId: context.enrollment.id, position: 1, completed: true },
      });
      return { attempt, progress };
    });
    return { ...result, practiceAttemptId: attemptId, courseCompletion: await this.completionFor(context.enrollment.id, assignmentId, context.assignment.courseVersionId, submissionId) };
  }

  async submitCourse(auth: AuthContext, schoolId: string, assignmentId: string, submissionId: string, expectedRevision: number) {
    const enrollment = await this.studentEnrollment(auth, schoolId);
    const assignment = await this.visibleAssignment(schoolId, assignmentId, enrollment);
    const submission = await this.ownedSubmission(schoolId, assignmentId, submissionId, enrollment.id);
    const completion = await this.completionFor(enrollment.id, assignmentId, assignment.courseVersionId, submissionId);
    if (completion.progressPercent !== 100) throw new UnprocessableEntityException("请先完成全部必修活动和课程练习");
    if (submission.revision !== expectedRevision) throw new ConflictException("课程提交已更新，请刷新后重试");
    if (submission.status === "SUBMITTED" || submission.status === "PROCESSING") return { submission: this.submissionSummary(submission), courseCompletion: completion };
    const updated = await this.prisma.submission.updateMany({ where: { id: submissionId, schoolId, revision: expectedRevision, status: { in: ["IN_PROGRESS", "PENDING_SYNC"] } }, data: { status: "SUBMITTED", submittedAt: new Date(), revision: { increment: 1 } } });
    if (updated.count !== 1) throw new ConflictException("课程提交状态冲突");
    const saved = await this.prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });
    return { submission: this.submissionSummary(saved), courseCompletion: await this.completionFor(enrollment.id, assignmentId, assignment.courseVersionId, submissionId) };
  }

  async listNotes(auth: AuthContext, schoolId: string, activityId: string) {
    const enrollment = await this.studentEnrollment(auth, schoolId);
    await this.assertActivityVisible(schoolId, activityId, enrollment);
    return this.prisma.studentActivityNote.findMany({
      where: { schoolId, enrollmentId: enrollment.id, activityId },
      orderBy: [{ videoTimestamp: "asc" }, { createdAt: "asc" }],
      select: { id: true, content: true, videoTimestamp: true, revision: true, createdAt: true, updatedAt: true },
    });
  }

  /** Compatibility API for the existing single general-note player. */
  async getNote(auth: AuthContext, schoolId: string, activityId: string) {
    const enrollment = await this.studentEnrollment(auth, schoolId);
    await this.assertActivityVisible(schoolId, activityId, enrollment);
    const note = await this.prisma.studentActivityNote.findFirst({
      where: { schoolId, enrollmentId: enrollment.id, activityId, videoTimestamp: null },
      orderBy: { createdAt: "asc" },
    });
    return note ?? { id: null, schoolId, enrollmentId: enrollment.id, activityId, content: "", revision: 0, createdAt: null, updatedAt: null };
  }

  async createNote(auth: AuthContext, schoolId: string, activityId: string, body: CreateStudentActivityNoteDto) {
    const enrollment = await this.studentEnrollment(auth, schoolId);
    await this.assertActivityVisible(schoolId, activityId, enrollment);
    return this.prisma.studentActivityNote.create({
      data: { schoolId, enrollmentId: enrollment.id, activityId, content: body.content, videoTimestamp: body.videoTimestamp ?? null, revision: 1 },
    });
  }

  /** Compatibility API for the existing single general-note player. */
  async saveNote(auth: AuthContext, schoolId: string, activityId: string, body: SaveStudentActivityNoteDto) {
    const enrollment = await this.studentEnrollment(auth, schoolId);
    await this.assertActivityVisible(schoolId, activityId, enrollment);
    const existing = await this.prisma.studentActivityNote.findFirst({
      where: { schoolId, enrollmentId: enrollment.id, activityId, videoTimestamp: null },
      orderBy: { createdAt: "asc" },
    });
    if (!existing) {
      if (body.revision !== 0) throw new ConflictException("笔记已在其他页面创建，请刷新后重试");
      return this.prisma.studentActivityNote.create({ data: { schoolId, enrollmentId: enrollment.id, activityId, content: body.content, revision: 1 } });
    }
    if (existing.revision !== body.revision) throw new ConflictException("笔记版本冲突，请刷新后保留最新内容");
    return this.prisma.studentActivityNote.update({ where: { id: existing.id }, data: { content: body.content, revision: { increment: 1 } } });
  }

  async updateNote(auth: AuthContext, schoolId: string, activityId: string, noteId: string, body: UpdateStudentActivityNoteDto) {
    const enrollment = await this.studentEnrollment(auth, schoolId);
    const existing = await this.prisma.studentActivityNote.findFirst({ where: { id: noteId, schoolId, enrollmentId: enrollment.id, activityId } });
    if (!existing) throw new NotFoundException("笔记不存在");
    if (existing.revision !== body.revision) throw new ConflictException("笔记版本冲突，请刷新后保留最新内容");
    return this.prisma.studentActivityNote.update({
      where: { id: noteId },
      data: { content: body.content, videoTimestamp: body.videoTimestamp ?? existing.videoTimestamp, revision: { increment: 1 } },
    });
  }

  async deleteNote(auth: AuthContext, schoolId: string, activityId: string, noteId: string) {
    const enrollment = await this.studentEnrollment(auth, schoolId);
    const existing = await this.prisma.studentActivityNote.findFirst({ where: { id: noteId, schoolId, enrollmentId: enrollment.id, activityId } });
    if (!existing) throw new NotFoundException("笔记不存在");
    await this.prisma.studentActivityNote.delete({ where: { id: noteId } });
    return { deleted: true };
  }

  async toggleFavorite(auth: AuthContext, schoolId: string, assignmentId: string) {
    const enrollment = await this.studentEnrollment(auth, schoolId);
    const assignment = await this.visibleAssignment(schoolId, assignmentId, enrollment);
    const courseVersionId = assignment.courseVersionId;

    const existing = await this.prisma.courseFavorite.findUnique({
      where: { enrollmentId_courseVersionId: { enrollmentId: enrollment.id, courseVersionId } },
    });

    if (existing) {
      await this.prisma.courseFavorite.delete({ where: { id: existing.id } });
      return { favorited: false };
    }

    await this.prisma.courseFavorite.create({
      data: { schoolId, enrollmentId: enrollment.id, courseVersionId },
    });
    return { favorited: true };
  }

  async recommendations(auth: AuthContext, schoolId: string, assignmentId: string) {
    const enrollment = await this.studentEnrollment(auth, schoolId);
    const assignment = await this.visibleAssignment(schoolId, assignmentId, enrollment);
    const cv = assignment.courseVersion;

    // Recommend courses with same capabilityTheme or gradeBand, excluding current
    const recommended = await this.prisma.assignment.findMany({
      where: {
        schoolId,
        status: "OPEN",
        deletedAt: null,
        id: { not: assignmentId },
        courseVersion: {
          status: "PUBLISHED",
          publishedAt: { not: null },
          retiredAt: null,
          OR: [
            ...(cv.capabilityTheme ? [{ capabilityTheme: cv.capabilityTheme }] : []),
            ...(cv.gradeBand ? [{ gradeBand: cv.gradeBand }] : []),
          ],
        },
        targets: { some: { OR: [{ enrollmentId: enrollment.id }, { classId: enrollment.classId }] } },
      },
      include: {
        courseVersion: { select: { id: true, title: true, capabilityTheme: true, gradeBand: true, difficulty: true, coverAsset: true, estimatedMinutes: true } },
      },
      take: 6,
      orderBy: { createdAt: "desc" },
    });

    return recommended.map((r) => ({
      assignmentId: r.id,
      courseVersion: r.courseVersion,
    }));
  }

  async listFavorites(auth: AuthContext, schoolId: string) {
    const enrollment = await this.studentEnrollment(auth, schoolId);
    const favorites = await this.prisma.courseFavorite.findMany({
      where: { enrollmentId: enrollment.id, schoolId },
      include: { courseVersion: { select: { id: true, title: true, capabilityTheme: true, gradeBand: true, difficulty: true, coverAsset: true } } },
      orderBy: { createdAt: "desc" },
    });
    return favorites.map((fav) => ({
      courseVersionId: fav.courseVersionId,
      favoritedAt: fav.createdAt.toISOString(),
      courseVersion: fav.courseVersion,
    }));
  }

  async stats(auth: AuthContext, schoolId: string) {
    const enrollment = await this.studentEnrollment(auth, schoolId);
    const totalAssigned = await this.prisma.assignment.count({
      where: { schoolId, status: "OPEN", deletedAt: null, targets: { some: { OR: [{ enrollmentId: enrollment.id }, { classId: enrollment.classId }] } } },
    });
    const inProgress = await this.prisma.submission.count({
      where: { schoolId, enrollmentId: enrollment.id, deletedAt: null, status: { in: ["IN_PROGRESS", "PENDING_SYNC"] } },
    });
    const completed = await this.prisma.submission.count({
      where: { schoolId, enrollmentId: enrollment.id, deletedAt: null, status: { in: ["SUBMITTED", "PROCESSING", "REVIEWED", "ACCEPTED"] } },
    });
    const favoriteCount = await this.prisma.courseFavorite.count({
      where: { enrollmentId: enrollment.id, schoolId },
    });
    const totalLearningMinutes = await this.prisma.activityProgress.aggregate({
      _sum: { position: true },
      where: { enrollmentId: enrollment.id, schoolId },
    });
    return {
      totalAssigned,
      inProgress,
      completed,
      notStarted: totalAssigned - inProgress - completed,
      favoriteCount,
      totalLearningMinutes: Math.round((totalLearningMinutes._sum.position ?? 0) * 10),
    };
  }

  private async studentEnrollment(auth: AuthContext, schoolId: string) {
    if (auth.tenant.schoolId !== schoolId || !auth.principal.roles.includes("STUDENT" as never)) throw new ForbiddenException("无权访问该学校的学生课程");
    const enrollment = await this.prisma.enrollment.findFirst({ where: { schoolId, userId: auth.principal.userId, role: "STUDENT", status: "ACTIVE" }, select: { id: true, classId: true } });
    if (!enrollment) throw new ForbiddenException("当前用户没有有效的学生班级关系");
    return enrollment;
  }

  private visibleAssignment(schoolId: string, assignmentId: string, enrollment: { id: string; classId: string }) {
    return this.prisma.assignment.findFirstOrThrow({
      where: { id: assignmentId, schoolId, status: "OPEN", deletedAt: null, courseVersion: { status: "PUBLISHED", publishedAt: { not: null }, retiredAt: null }, targets: { some: { OR: [{ enrollmentId: enrollment.id }, { classId: enrollment.classId }] } } },
      include: {
        courseVersion: {
          include: {
            course: { select: { id: true, stableKey: true, title: true } },
            units: { orderBy: { sortOrder: "asc" }, include: { lessons: { orderBy: { sortOrder: "asc" }, include: { activities: { orderBy: { sortOrder: "asc" }, include: {
              resources: { include: { resource: { select: { id: true, kind: true, originalName: true, mediaType: true, byteSize: true } } } },
              progress: { where: { enrollmentId: enrollment.id }, take: 1 },
              attempts: { where: { submission: { enrollmentId: enrollment.id } }, orderBy: { createdAt: "desc" }, take: 1 },
              coursePractice: { include: { practiceDefinition: { select: { id: true, title: true } } } },
            } } } } } },
          },
        },
      },
    }).catch(() => { throw new NotFoundException("课程不存在或未向当前学生发布"); });
  }

  private async assertActivityVisible(schoolId: string, activityId: string, enrollment: { id: string; classId: string }) {
    const activity = await this.prisma.learningActivity.findFirst({ where: { id: activityId, lesson: { unit: { courseVersion: { schoolId, status: "PUBLISHED", assignments: { some: { schoolId, status: "OPEN", targets: { some: { OR: [{ enrollmentId: enrollment.id }, { classId: enrollment.classId }] } } } } } } } }, select: { id: true } });
    if (!activity) throw new NotFoundException("学习活动不存在或不可访问");
  }

  private async activityContext(auth: AuthContext, schoolId: string, assignmentId: string, submissionId: string, activityId: string) {
    const enrollment = await this.studentEnrollment(auth, schoolId);
    const assignment = await this.visibleAssignment(schoolId, assignmentId, enrollment);
    await this.ownedSubmission(schoolId, assignmentId, submissionId, enrollment.id);
    const activity = assignment.courseVersion.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities)).find((candidate) => candidate.id === activityId);
    if (!activity) throw new NotFoundException("活动不属于当前课程");
    return { enrollment, assignment, activity };
  }

  private async ownedSubmission(schoolId: string, assignmentId: string, submissionId: string, enrollmentId: string) {
    const submission = await this.prisma.submission.findFirst({ where: { id: submissionId, schoolId, assignmentId, enrollmentId, deletedAt: null } });
    if (!submission) throw new NotFoundException("课程 Submission 不存在");
    return submission;
  }

  private async completionFor(enrollmentId: string, assignmentId: string, courseVersionId: string, submissionId?: string) {
    const requiredActivities = await this.prisma.learningActivity.findMany({ where: { required: true, lesson: { unit: { courseVersionId } } }, select: { id: true, coursePractice: { select: { required: true } } } });
    const progress = await this.prisma.activityProgress.findMany({ where: { enrollmentId, completed: true, activityId: { in: requiredActivities.map((activity) => activity.id) } }, select: { activityId: true } });
    const completedActivityIds = progress.map((item) => item.activityId);
    const requiredPracticeIds = requiredActivities.filter((activity) => activity.coursePractice?.required).map((activity) => activity.id);

    // Per-activity practice completion: check each required practice individually
    // across ALL submissions (not just the current one)
    let completedPracticeActivityIds: string[] = [];
    if (requiredPracticeIds.length > 0) {
      const finishedSessions = await this.prisma.assessmentSession.findMany({
        where: { enrollmentId, courseActivityId: { in: requiredPracticeIds }, status: { in: [...FINISHED_PRACTICE_STATUSES] } },
        select: { courseActivityId: true },
        distinct: ["courseActivityId"],
      });
      completedPracticeActivityIds = finishedSessions.map((s) => s.courseActivityId!);
    }
    const completedPracticeCount = completedPracticeActivityIds.length;

    const completedRequiredCount = requiredActivities.filter((activity) =>
      completedActivityIds.includes(activity.id) && (!activity.coursePractice?.required || completedPracticeActivityIds.includes(activity.id))
    ).length;
    const progressPercent = requiredActivities.length === 0 ? 0 : Math.round((completedRequiredCount / requiredActivities.length) * 100);
    const speechJobs = submissionId ? await this.prisma.speechJob.findMany({ where: { submissionId }, select: { status: true, result: true, errorCode: true } }) : [];
    const attainmentStatus = this.attainment(speechJobs, progressPercent);
    return { requiredActivityCount: requiredActivities.length, completedRequiredCount, requiredPracticeCount: requiredPracticeIds.length, completedPracticeCount, progressPercent, attainmentStatus, completedActivityIds };
  }

  private attainment(jobs: Array<{ status: string; result: unknown; errorCode: string | null }>, progressPercent: number) {
    if (jobs.some((job) => job.status === "FAILED" && /PROVIDER|UNAVAILABLE/.test(job.errorCode ?? ""))) return "PROVIDER_UNAVAILABLE";
    if (jobs.some((job) => job.status === "NEEDS_REVIEW")) return "NEEDS_REVIEW";
    if (jobs.some((job) => ["CREATED", "QUALITY_CHECKED", "PROCESSING"].includes(job.status))) return "PENDING";
    if (jobs.some((job) => typeof job.result === "object" && job.result && (job.result as Record<string, unknown>).passed === false)) return "NEEDS_PRACTICE";
    return progressPercent === 100 ? "PASSED" : "PENDING";
  }

  private catalogStatus(submissionStatus: string | undefined, progressPercent: number, attainmentStatus: string) {
    if (!submissionStatus) return "NOT_STARTED";
    if (progressPercent < 100) return "IN_PROGRESS";
    if (attainmentStatus === "PENDING") return "RESULT_PENDING";
    return "COMPLETED";
  }

  private publishedStudentNotes(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const notes = value as Record<string, unknown>;
    return notes.published === true ? notes : null;
  }

  private submissionSummary(submission: { id: string; assignmentId: string; enrollmentId: string; attemptNo: number; status: string; revision: number; submittedAt: Date | null; createdAt: Date; updatedAt: Date }) {
    return { id: submission.id, assignmentId: submission.assignmentId, enrollmentId: submission.enrollmentId, attemptNo: submission.attemptNo, status: submission.status, revision: submission.revision, submittedAt: submission.submittedAt?.toISOString() ?? null, createdAt: submission.createdAt.toISOString(), updatedAt: submission.updatedAt.toISOString() };
  }
}
