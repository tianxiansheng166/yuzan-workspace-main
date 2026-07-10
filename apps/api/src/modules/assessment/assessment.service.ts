import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AuthContext } from "../../common/security/auth.types.js";
import {
  hasRole,
  MembershipRole,
  MembershipStatus,
} from "../../common/security/index.js";
import type { AssignmentRepositoryPort } from "../assignments/ports/assignment-repository.port.js";
import { ASSIGNMENT_REPOSITORY } from "../assignments/ports/assignment-repository.port.js";
import { CLOCK, type Clock } from "../assignments/ports/clock.port.js";
import type { ClassRepositoryPort } from "../classes/ports/class-repository.port.js";
import { CLASS_REPOSITORY } from "../classes/ports/class-repository.port.js";
import type { CourseVersionRepositoryPort } from "../curriculum/ports/course-version-repository.port.js";
import { COURSE_VERSION_REPOSITORY } from "../curriculum/ports/course-version-repository.port.js";
import { AssessmentPolicy } from "./assessment.policy.js";
import type {
  AnswerDraft,
  AnswerValue,
  ActivityAttempt,
  Exercise,
  ExerciseContent,
  ExerciseResult,
  Question,
} from "./domain/assessment.types.js";
import {
  AssessmentConflictException,
  AssessmentForbiddenException,
  AssessmentNotFoundException,
  AssessmentPreconditionFailedException,
  AssessmentValidationException,
} from "./domain/assessment.errors.js";
import { gradeAnswers, hasManualReview } from "./domain/assessment.grader.js";
import { withAnswerKeyVisibility } from "./domain/question.serializer.js";
import type { SaveDraftDto, SubmitAnswersDto } from "./dto/assessment.dto.js";
import {
  toAttemptResponse,
  toDraftResponse,
  toExerciseResponse,
  toResultResponse,
} from "./dto/assessment.response.js";
import type { AssessmentRepositoryPort } from "./ports/assessment-repository.port.js";
import { ASSESSMENT_REPOSITORY } from "./ports/assessment-repository.port.js";

@Injectable()
export class AssessmentService {
  private readonly policy = new AssessmentPolicy();

  constructor(
    @Inject(ASSIGNMENT_REPOSITORY)
    private readonly assignmentRepo: AssignmentRepositoryPort,
    @Inject(CLASS_REPOSITORY)
    private readonly classRepo: ClassRepositoryPort,
    @Inject(COURSE_VERSION_REPOSITORY)
    private readonly courseRepo: CourseVersionRepositoryPort,
    @Inject(ASSESSMENT_REPOSITORY)
    private readonly assessmentRepo: AssessmentRepositoryPort,
    @Inject(CLOCK)
    private readonly clock: Clock,
  ) {}

  async getExercise(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
    activityId: string,
  ) {
    if (!this.policy.canAccessAssessment(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }

    const { assignment, enrollmentId } = await this.requireVisibleAssignment(
      auth,
      schoolId,
      assignmentId,
    );

    const activity = await this.requireCourseVersionActivity(
      schoolId,
      assignment.courseVersionId,
      activityId,
    );

    const visibility = this.policy.checkVisibility(assignment);
    const answerKeyVisible = this.policy.canViewAnswerKey(
      auth,
      assignment,
      this.clock,
      false,
    );

    const questions = this.extractQuestions(activity).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );

    const exercise: Exercise = {
      assignmentId: assignment.id,
      activityId,
      courseVersionId: assignment.courseVersionId,
      title: assignment.title,
      studentNotes: assignment.studentNotes ?? null,
      publishAt: assignment.publishAt ?? null,
      dueAt: assignment.dueAt ?? null,
      latePolicy: assignment.latePolicy,
      retryPolicy: assignment.retryPolicy,
      questions: withAnswerKeyVisibility(questions, answerKeyVisible),
      canStart: visibility.canStart,
      canSubmit: visibility.canSubmit,
      reason: visibility.reason,
    };

    return toExerciseResponse(exercise);
  }

  async getDraft(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
    activityId: string,
  ) {
    if (!this.policy.canAccessAssessment(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }

    await this.requireVisibleAssignment(auth, schoolId, assignmentId);

    const draft = await this.assessmentRepo.findDraft(
      schoolId,
      assignmentId,
      activityId,
      auth.principal.userId,
    );

    if (!draft) {
      throw new AssessmentNotFoundException("暂无草稿");
    }

    return toDraftResponse(draft);
  }

  async saveDraft(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
    activityId: string,
    dto: SaveDraftDto,
  ) {
    if (!this.policy.canAccessAssessment(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }

    const { assignment, enrollmentId } = await this.requireVisibleAssignment(
      auth,
      schoolId,
      assignmentId,
    );

    const activity = await this.requireCourseVersionActivity(
      schoolId,
      assignment.courseVersionId,
      activityId,
    );

    const visibility = this.policy.checkVisibility(assignment);
    if (!visibility.canStart) {
      throw new AssessmentPreconditionFailedException(
        visibility.reason ?? "当前不可作答",
      );
    }

    const questions = this.extractQuestions(activity);
    const answers = this.validateAndNormalizeAnswers(questions, dto.answers);

    const existing = await this.assessmentRepo.findDraft(
      schoolId,
      assignmentId,
      activityId,
      auth.principal.userId,
    );

    const now = this.clock.now();
    const draft: AnswerDraft = {
      id: existing?.id ?? randomUUID(),
      schoolId,
      assignmentId,
      activityId,
      studentUserId: auth.principal.userId,
      enrollmentId,
      answers,
      updatedAt: now,
    };

    const saved = await this.assessmentRepo.saveDraft(draft, {
      generateId: !existing,
    });
    return toDraftResponse(saved);
  }

  async submitAnswers(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
    activityId: string,
    dto: SubmitAnswersDto,
  ) {
    if (!this.policy.canAccessAssessment(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }

    const { assignment, enrollmentId } = await this.requireVisibleAssignment(
      auth,
      schoolId,
      assignmentId,
    );

    const activity = await this.requireCourseVersionActivity(
      schoolId,
      assignment.courseVersionId,
      activityId,
    );

    const visibility = this.policy.checkVisibility(assignment);
    if (!visibility.canSubmit) {
      throw new AssessmentPreconditionFailedException(
        visibility.reason ?? "当前不可提交",
      );
    }

    const questions = this.extractQuestions(activity);
    const answers = this.validateAndNormalizeAnswers(questions, dto.answers);

    const attemptCount = await this.assessmentRepo.countAttempts(
      schoolId,
      assignmentId,
      activityId,
      enrollmentId,
    );

    if (attemptCount >= assignment.retryPolicy.maxAttempts) {
      throw new AssessmentConflictException(
        `已达到最大作答次数 (${assignment.retryPolicy.maxAttempts})`,
      );
    }

    const attemptNo = attemptCount + 1;
    const now = this.clock.now();

    const autoResult = gradeAnswers(questions, answers);
    const needsManualReview = hasManualReview(questions);

    const status: ActivityAttempt["status"] = needsManualReview
      ? "NEEDS_REVIEW"
      : "GRADED";

    const attempt: ActivityAttempt = {
      id: randomUUID(),
      schoolId,
      assignmentId,
      activityId,
      studentUserId: auth.principal.userId,
      enrollmentId,
      attemptNo,
      answers,
      status,
      autoResult,
      submittedAt: now,
      gradedAt: needsManualReview ? undefined : now,
    };

    const saved = await this.assessmentRepo.saveAttempt(attempt, {
      generateId: false,
    });
    return toAttemptResponse(saved);
  }

  async getResult(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
    activityId: string,
    attemptId: string,
  ) {
    if (!this.policy.canAccessAssessment(auth, schoolId)) {
      throw new AssessmentForbiddenException();
    }

    const { assignment, enrollmentId } = await this.requireVisibleAssignment(
      auth,
      schoolId,
      assignmentId,
    );

    const activity = await this.requireCourseVersionActivity(
      schoolId,
      assignment.courseVersionId,
      activityId,
    );

    const attempt = await this.assessmentRepo.findAttemptById(
      schoolId,
      attemptId,
    );
    if (!attempt || attempt.enrollmentId !== enrollmentId) {
      throw new AssessmentNotFoundException();
    }

    const questions = this.extractQuestions(activity).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );

    const hasSubmitted = true;
    const answerKeyVisible = this.policy.canViewAnswerKey(
      auth,
      assignment,
      this.clock,
      hasSubmitted,
    );

    const result: ExerciseResult = {
      attemptId: attempt.id,
      assignmentId: attempt.assignmentId,
      activityId: attempt.activityId,
      attemptNo: attempt.attemptNo,
      status: attempt.status,
      answers: attempt.answers,
      autoResult: attempt.autoResult,
      questions: withAnswerKeyVisibility(questions, answerKeyVisible),
      answerKeyVisible,
      submittedAt: attempt.submittedAt,
      gradedAt: attempt.gradedAt,
    };

    return toResultResponse(result);
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
      throw new AssessmentNotFoundException();
    }

    if (assignment.status !== "PUBLISHED") {
      throw new AssessmentNotFoundException();
    }

    const isActiveStudent = await this.isActiveStudentOfClass(
      auth,
      schoolId,
      assignment.classId,
    );
    if (!isActiveStudent) {
      throw new AssessmentNotFoundException();
    }

    return {
      assignment,
      enrollmentId: `${assignment.classId}:${auth.principal.userId}`,
    };
  }

  private async isActiveStudentOfClass(
    auth: AuthContext,
    schoolId: string,
    classId: string,
  ): Promise<boolean> {
    if (!hasRole(auth, MembershipRole.STUDENT)) {
      return false;
    }

    if (auth.principal.membershipStatus !== MembershipStatus.ACTIVE) {
      return false;
    }

    return this.classRepo.hasActiveStudentEnrollment(
      schoolId,
      classId,
      auth.principal.userId,
    );
  }

  private async requireCourseVersionActivity(
    schoolId: string,
    courseVersionId: string,
    activityId: string,
  ): Promise<import("../curriculum/domain/course-version.types.js").Activity> {
    const version = await this.courseRepo.findById(schoolId, courseVersionId);
    if (!version) {
      throw new AssessmentNotFoundException();
    }

    const activity = version.units
      .flatMap((unit) => unit.lessons)
      .flatMap((lesson) => lesson.activities)
      .find((a) => a.id === activityId);

    if (!activity) {
      throw new AssessmentNotFoundException("活动不存在");
    }

    return activity;
  }

  private extractQuestions(
    activity: import("../curriculum/domain/course-version.types.js").Activity,
  ): Question[] {
    const content = activity.content as ExerciseContent | undefined;
    if (!content || !Array.isArray(content.questions)) {
      return [];
    }
    return content.questions as Question[];
  }

  private validateAndNormalizeAnswers(
    questions: readonly Question[],
    raw: Record<string, unknown>,
  ): Readonly<Record<string, AnswerValue>> {
    const result: Record<string, AnswerValue> = {};

    for (const question of questions) {
      const value = raw[question.id];
      if (value === undefined || value === null) {
        continue;
      }

      result[question.id] = this.normalizeAnswer(question.kind, value);
    }

    return result;
  }

  private normalizeAnswer(kind: Question["kind"], value: unknown): AnswerValue {
    switch (kind) {
      case "SINGLE_CHOICE": {
        if (typeof value !== "object" || value === null) {
          throw new AssessmentValidationException("单选答案格式错误");
        }
        const optionId = (value as Record<string, unknown>).optionId;
        if (typeof optionId !== "string") {
          throw new AssessmentValidationException("单选答案缺少 optionId");
        }
        return { kind, optionId };
      }
      case "MULTIPLE_CHOICE": {
        if (typeof value !== "object" || value === null) {
          throw new AssessmentValidationException("多选答案格式错误");
        }
        const optionIds = (value as Record<string, unknown>).optionIds;
        if (
          !Array.isArray(optionIds) ||
          !optionIds.every((id) => typeof id === "string")
        ) {
          throw new AssessmentValidationException("多选答案缺少 optionIds");
        }
        return { kind, optionIds };
      }
      case "FILL_BLANK": {
        if (typeof value !== "object" || value === null) {
          throw new AssessmentValidationException("填空答案格式错误");
        }
        const values = (value as Record<string, unknown>).values;
        if (
          !Array.isArray(values) ||
          !values.every((v) => typeof v === "string")
        ) {
          throw new AssessmentValidationException("填空答案缺少 values");
        }
        return { kind, values };
      }
      case "SHORT_ANSWER": {
        if (typeof value !== "object" || value === null) {
          throw new AssessmentValidationException("简答答案格式错误");
        }
        const text = (value as Record<string, unknown>).text;
        if (typeof text !== "string") {
          throw new AssessmentValidationException("简答答案缺少 text");
        }
        return { kind, text };
      }
      case "ORDERING": {
        if (typeof value !== "object" || value === null) {
          throw new AssessmentValidationException("排序答案格式错误");
        }
        const order = (value as Record<string, unknown>).order;
        if (
          !Array.isArray(order) ||
          !order.every((id) => typeof id === "string")
        ) {
          throw new AssessmentValidationException("排序答案缺少 order");
        }
        return { kind, order };
      }
      case "MATCHING": {
        if (typeof value !== "object" || value === null) {
          throw new AssessmentValidationException("匹配答案格式错误");
        }
        const matches = (value as Record<string, unknown>).matches;
        if (typeof matches !== "object" || matches === null) {
          throw new AssessmentValidationException("匹配答案缺少 matches");
        }
        return { kind, matches: matches as Record<string, string> };
      }
      default:
        throw new AssessmentValidationException("未知题型");
    }
  }
}
