import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AuthContext } from "../../common/security/auth.types.js";
import { ASSIGNMENT_REPOSITORY } from "../assignments/ports/assignment-repository.port.js";
import type { AssignmentRepositoryPort } from "../assignments/ports/assignment-repository.port.js";
import { CLASS_REPOSITORY } from "../classes/ports/class-repository.port.js";
import type { ClassRepositoryPort } from "../classes/ports/class-repository.port.js";
import { COURSE_VERSION_REPOSITORY } from "../curriculum/ports/course-version-repository.port.js";
import type { CourseVersionRepositoryPort } from "../curriculum/ports/course-version-repository.port.js";
import { LearningPolicy } from "./learning.policy.js";
import type {
  ActivityDetail,
  LearningSession,
  TodayLearningItem,
} from "./domain/learning.types.js";
import {
  LearningForbiddenException,
  LearningNotFoundException,
  LearningPreconditionFailedException,
  LearningValidationException,
} from "./domain/learning.errors.js";
import type {
  CompleteActivityDto,
  UpdateProgressDto,
} from "./dto/progress.dto.js";
import {
  toProgressResponse,
  toSessionResponse,
  toSubmissionResponse,
} from "./dto/learning.response.js";
import type { LearningRepositoryPort } from "./ports/learning-repository.port.js";
import { LEARNING_REPOSITORY } from "./ports/learning-repository.port.js";

@Injectable()
export class LearningService {
  private readonly policy = new LearningPolicy();

  constructor(
    @Inject(ASSIGNMENT_REPOSITORY)
    private readonly assignmentRepo: AssignmentRepositoryPort,
    @Inject(CLASS_REPOSITORY)
    private readonly classRepo: ClassRepositoryPort,
    @Inject(COURSE_VERSION_REPOSITORY)
    private readonly courseRepo: CourseVersionRepositoryPort,
    @Inject(LEARNING_REPOSITORY)
    private readonly learningRepo: LearningRepositoryPort,
  ) {}

  async listToday(auth: AuthContext, schoolId: string) {
    if (!this.policy.canAccessLearning(auth, schoolId)) {
      throw new LearningForbiddenException();
    }

    const enrollments = await this.classRepo.listEnrollmentsByUser(
      schoolId,
      auth.principal.userId,
    );
    const enrolledClassIds = new Set(enrollments.map((e) => e.classId));

    const result = await this.assignmentRepo.list(schoolId, {
      status: "PUBLISHED",
      limit: 200,
    });

    const items: TodayLearningItem[] = [];
    for (const summary of result.items) {
      if (!enrolledClassIds.has(summary.classId)) {
        continue;
      }

      const assignment = await this.assignmentRepo.findById(
        schoolId,
        summary.id,
      );
      if (!assignment || assignment.status !== "PUBLISHED") {
        continue;
      }

      const visibility = this.checkVisibility(assignment);
      if (!visibility.visible) {
        continue;
      }

      for (const activity of assignment.activityRefs) {
        const session = await this.learningRepo.findSession(
          schoolId,
          assignment.id,
          activity.activityId,
          auth.principal.userId,
        );
        const progress = session
          ? await this.learningRepo.findProgress(
              schoolId,
              assignment.id,
              activity.activityId,
              auth.principal.userId,
            )
          : null;

        items.push({
          assignmentId: assignment.id,
          classId: assignment.classId,
          courseVersionId: assignment.courseVersionId,
          title: assignment.title,
          studentNotes: assignment.studentNotes ?? null,
          dueAt: assignment.dueAt ?? null,
          activity: {
            activityId: activity.activityId,
            activityType: activity.activityType,
            title: activity.title,
          },
          sessionId: session?.id ?? null,
          progressPercent: progress?.progressPercent ?? 0,
        });
      }
    }

    return { items };
  }

  async getActivityDetail(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
    activityId: string,
  ) {
    if (!this.policy.canAccessLearning(auth, schoolId)) {
      throw new LearningForbiddenException();
    }

    const { assignment, enrollmentId } = await this.requireVisibleAssignment(
      auth,
      schoolId,
      assignmentId,
    );

    const activity = assignment.activityRefs.find(
      (ref) => ref.activityId === activityId,
    );
    if (!activity) {
      throw new LearningNotFoundException();
    }

    await this.requireCourseVersionActivity(
      schoolId,
      assignment.courseVersionId,
      activityId,
    );

    const visibility = this.checkVisibility(assignment);
    const detail: ActivityDetail = {
      assignmentId: assignment.id,
      classId: assignment.classId,
      courseVersionId: assignment.courseVersionId,
      assignmentTitle: assignment.title,
      studentNotes: assignment.studentNotes ?? null,
      publishAt: assignment.publishAt ?? null,
      dueAt: assignment.dueAt ?? null,
      latePolicy: assignment.latePolicy,
      retryPolicy: assignment.retryPolicy,
      activity: {
        activityId: activity.activityId,
        activityType: activity.activityType,
        title: activity.title,
      },
      canStart: visibility.canStart,
      canSubmit: visibility.canSubmit,
      reason: visibility.reason,
    };

    return detail;
  }

  async startSession(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
    activityId: string,
  ) {
    if (!this.policy.canAccessLearning(auth, schoolId)) {
      throw new LearningForbiddenException();
    }

    const { assignment, enrollmentId } = await this.requireVisibleAssignment(
      auth,
      schoolId,
      assignmentId,
    );

    const activity = assignment.activityRefs.find(
      (ref) => ref.activityId === activityId,
    );
    if (!activity) {
      throw new LearningNotFoundException();
    }

    await this.requireCourseVersionActivity(
      schoolId,
      assignment.courseVersionId,
      activityId,
    );

    const visibility = this.checkVisibility(assignment);
    if (!visibility.canStart) {
      throw new LearningPreconditionFailedException(
        visibility.reason ?? "当前不可开始学习",
      );
    }

    const existing = await this.learningRepo.findSession(
      schoolId,
      assignmentId,
      activityId,
      auth.principal.userId,
    );
    if (existing) {
      return toSessionResponse(existing);
    }

    const now = new Date();
    const session: LearningSession = {
      id: randomUUID(),
      schoolId,
      assignmentId,
      activityId,
      studentUserId: auth.principal.userId,
      enrollmentId,
      status: "ACTIVE",
      startedAt: now,
      lastActiveAt: now,
    };

    const saved = await this.learningRepo.saveSession(session, {
      generateId: false,
    });
    return toSessionResponse(saved);
  }

  async getProgress(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
    activityId: string,
  ) {
    if (!this.policy.canAccessLearning(auth, schoolId)) {
      throw new LearningForbiddenException();
    }

    await this.requireVisibleAssignment(auth, schoolId, assignmentId);

    const progress = await this.learningRepo.findProgress(
      schoolId,
      assignmentId,
      activityId,
      auth.principal.userId,
    );
    if (!progress) {
      throw new LearningNotFoundException("暂无进度记录");
    }

    return toProgressResponse(progress);
  }

  async updateProgress(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
    activityId: string,
    dto: UpdateProgressDto,
  ) {
    if (!this.policy.canAccessLearning(auth, schoolId)) {
      throw new LearningForbiddenException();
    }

    const { assignment, enrollmentId } = await this.requireVisibleAssignment(
      auth,
      schoolId,
      assignmentId,
    );

    const activity = assignment.activityRefs.find(
      (ref) => ref.activityId === activityId,
    );
    if (!activity) {
      throw new LearningNotFoundException();
    }

    const session = await this.learningRepo.findSession(
      schoolId,
      assignmentId,
      activityId,
      auth.principal.userId,
    );
    if (!session || session.status !== "ACTIVE") {
      throw new LearningPreconditionFailedException("请先开始学习活动");
    }

    const existing = await this.learningRepo.findProgress(
      schoolId,
      assignmentId,
      activityId,
      auth.principal.userId,
    );

    const now = new Date();
    const progress = existing
      ? {
          ...existing,
          progressPercent: dto.progressPercent,
          ...(dto.localState ? { localState: dto.localState } : {}),
          ...(dto.serverState ? { serverState: dto.serverState } : {}),
          updatedAt: now,
        }
      : {
          id: randomUUID(),
          schoolId,
          assignmentId,
          activityId,
          studentUserId: auth.principal.userId,
          enrollmentId,
          sessionId: session.id,
          progressPercent: dto.progressPercent,
          localState: dto.localState ?? {},
          serverState: dto.serverState ?? {},
          updatedAt: now,
        };

    const saved = await this.learningRepo.saveProgress(progress, {
      generateId: !existing,
    });
    return toProgressResponse(saved);
  }

  async completeActivity(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
    activityId: string,
    dto: CompleteActivityDto,
  ) {
    if (!this.policy.canAccessLearning(auth, schoolId)) {
      throw new LearningForbiddenException();
    }

    const { assignment, enrollmentId } = await this.requireVisibleAssignment(
      auth,
      schoolId,
      assignmentId,
    );

    const activity = assignment.activityRefs.find(
      (ref) => ref.activityId === activityId,
    );
    if (!activity) {
      throw new LearningNotFoundException();
    }

    const visibility = this.checkVisibility(assignment);
    if (!visibility.canSubmit) {
      throw new LearningPreconditionFailedException(
        visibility.reason ?? "当前不可提交",
      );
    }

    const session = await this.learningRepo.findSession(
      schoolId,
      assignmentId,
      activityId,
      auth.principal.userId,
    );
    if (!session || session.status !== "ACTIVE") {
      throw new LearningPreconditionFailedException("请先开始学习活动");
    }

    const attemptNo =
      (await this.learningRepo.countSubmissions(
        schoolId,
        assignmentId,
        enrollmentId,
      )) + 1;

    const now = new Date();
    const submission = {
      id: randomUUID(),
      schoolId,
      assignmentId,
      enrollmentId,
      attemptNo,
      activityIds: [activityId],
      status: "SUBMITTED" as const,
      submittedAt: now,
      ...(dto.answers ? { answers: dto.answers } : {}),
    };

    const saved = await this.learningRepo.saveSubmission(submission, {
      generateId: false,
    });

    const completedSession: LearningSession = {
      ...session,
      status: "COMPLETED",
      lastActiveAt: now,
      completedAt: now,
    };
    await this.learningRepo.saveSession(completedSession, {
      generateId: false,
    });

    return toSubmissionResponse(saved);
  }

  private async requireVisibleAssignment(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
  ): Promise<{
    assignment: import("../assignments/domain/assignment.types.js").Assignment;
    enrollmentId: string;
  }> {
    const assignment = await this.assignmentRepo.findById(
      schoolId,
      assignmentId,
    );
    if (!assignment) {
      throw new LearningNotFoundException();
    }

    if (assignment.status !== "PUBLISHED") {
      throw new LearningNotFoundException();
    }

    const enrollments = await this.classRepo.listEnrollmentsByUser(
      schoolId,
      auth.principal.userId,
    );
    const enrollment = enrollments.find(
      (e) => e.classId === assignment.classId,
    );
    if (!enrollment) {
      throw new LearningForbiddenException();
    }

    return {
      assignment,
      enrollmentId: `${enrollment.classId}:${auth.principal.userId}`,
    };
  }

  private async requireCourseVersionActivity(
    schoolId: string,
    courseVersionId: string,
    activityId: string,
  ): Promise<void> {
    const version = await this.courseRepo.findById(schoolId, courseVersionId);
    if (!version) {
      throw new LearningNotFoundException();
    }

    const activityExists = version.units.some((unit) =>
      unit.lessons.some((lesson) =>
        lesson.activities.some((activity) => activity.id === activityId),
      ),
    );
    if (!activityExists) {
      throw new LearningValidationException("活动不属于发布课程版本");
    }
  }

  private checkVisibility(assignment: {
    readonly publishAt?: Date;
    readonly dueAt?: Date;
    readonly latePolicy: string;
  }): {
    visible: boolean;
    canStart: boolean;
    canSubmit: boolean;
    reason?: string;
  } {
    const now = new Date();

    if (
      assignment.publishAt &&
      assignment.publishAt.getTime() > now.getTime()
    ) {
      return {
        visible: false,
        canStart: false,
        canSubmit: false,
        reason: "任务尚未开放",
      };
    }

    if (!assignment.dueAt || assignment.dueAt.getTime() >= now.getTime()) {
      return {
        visible: true,
        canStart: true,
        canSubmit: true,
      };
    }

    switch (assignment.latePolicy) {
      case "REJECT":
        return {
          visible: true,
          canStart: false,
          canSubmit: false,
          reason: "任务已截止，不接受 late 提交",
        };
      case "ACCEPT_WITH_PENALTY":
        return {
          visible: true,
          canStart: true,
          canSubmit: true,
          reason: "任务已截止，late 提交将扣分",
        };
      case "ACCEPT":
      default:
        return {
          visible: true,
          canStart: true,
          canSubmit: true,
          reason: "任务已截止，仍接受 late 提交",
        };
    }
  }
}
