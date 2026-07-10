import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AuthContext } from "../../common/security/auth.types.js";
import {
  hasRole,
  MembershipRole,
  MembershipStatus,
} from "../../common/security/index.js";
import type { ClassRepositoryPort } from "../classes/ports/class-repository.port.js";
import { CLASS_REPOSITORY } from "../classes/ports/class-repository.port.js";
import type { CourseVersionRepositoryPort } from "../curriculum/ports/course-version-repository.port.js";
import { COURSE_VERSION_REPOSITORY } from "../curriculum/ports/course-version-repository.port.js";
import { AssignmentsPolicy } from "./assignments.policy.js";
import type { Assignment } from "./domain/assignment.types.js";
import {
  AssignmentConflictException,
  AssignmentForbiddenException,
  AssignmentNotFoundException,
  AssignmentValidationException,
} from "./domain/assignment.errors.js";
import {
  toAssignmentResponse,
  toAssignmentSummaryResponse,
} from "./dto/assignment.response.js";
import type { CreateAssignmentDto } from "./dto/create-assignment.dto.js";
import type { ListAssignmentsQueryDto } from "./dto/list-assignments-query.dto.js";
import type { UpdateAssignmentDto } from "./dto/update-assignment.dto.js";
import type {
  AssignmentRepositoryPort,
  ListAssignmentsOptions,
} from "./ports/assignment-repository.port.js";
import { ASSIGNMENT_REPOSITORY } from "./ports/assignment-repository.port.js";
import { CLOCK, type Clock } from "./ports/clock.port.js";

@Injectable()
export class AssignmentsService {
  private readonly policy = new AssignmentsPolicy();

  constructor(
    @Inject(ASSIGNMENT_REPOSITORY)
    private readonly assignmentRepo: AssignmentRepositoryPort,
    @Inject(CLASS_REPOSITORY)
    private readonly classRepo: ClassRepositoryPort,
    @Inject(COURSE_VERSION_REPOSITORY)
    private readonly courseRepo: CourseVersionRepositoryPort,
    @Inject(CLOCK)
    private readonly clock: Clock,
  ) {}

  async createAssignment(
    auth: AuthContext,
    schoolId: string,
    dto: CreateAssignmentDto,
  ) {
    if (!this.policy.canCreate(auth, schoolId)) {
      throw new AssignmentForbiddenException();
    }

    const classItem = await this.classRepo.findById(schoolId, dto.classId);
    if (!classItem) {
      throw new AssignmentValidationException("班级不存在或不属于本校");
    }

    if (!this.isManagerOfClass(auth, classItem)) {
      throw new AssignmentForbiddenException("无权为该班级创建任务");
    }

    await this.requirePublishedCourseVersion(schoolId, dto.courseVersionId);
    this.validateSchedule(dto.publishAt, dto.dueAt);

    const now = this.clock.now();
    const assignment: Assignment = {
      id: randomUUID(),
      schoolId,
      classId: dto.classId,
      courseVersionId: dto.courseVersionId,
      title: dto.title,
      ...(dto.teacherNotes ? { teacherNotes: dto.teacherNotes } : {}),
      ...(dto.studentNotes ? { studentNotes: dto.studentNotes } : {}),
      activityRefs: dto.activityRefs.map((ref) => ({ ...ref })),
      status: "DRAFT",
      ...(dto.publishAt ? { publishAt: dto.publishAt } : {}),
      ...(dto.dueAt ? { dueAt: dto.dueAt } : {}),
      latePolicy: dto.latePolicy ?? "ACCEPT",
      retryPolicy: {
        maxAttempts: dto.retryPolicy?.maxAttempts ?? 1,
        allowRetest: dto.retryPolicy?.allowRetest ?? false,
      },
      createdByUserId: auth.principal.userId,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.assignmentRepo.save(assignment, {
      generateId: false,
    });
    return toAssignmentResponse(saved);
  }

  async getAssignment(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
  ) {
    const assignment = await this.assignmentRepo.findById(
      schoolId,
      assignmentId,
    );
    if (!assignment) {
      throw new AssignmentNotFoundException();
    }

    const isManager = await this.isManagerOfClassById(
      auth,
      schoolId,
      assignment.classId,
    );
    const isActiveStudent =
      hasRole(auth, MembershipRole.STUDENT) &&
      auth.principal.membershipStatus === MembershipStatus.ACTIVE
        ? await this.classRepo.hasActiveStudentEnrollment(
            schoolId,
            assignment.classId,
            auth.principal.userId,
          )
        : false;

    if (
      !this.policy.canRead(
        auth,
        assignment,
        this.clock,
        isActiveStudent,
        isManager,
      )
    ) {
      throw new AssignmentNotFoundException();
    }

    return toAssignmentResponse(assignment);
  }

  async listClassAssignments(
    auth: AuthContext,
    schoolId: string,
    classId: string,
    query: ListAssignmentsQueryDto,
  ) {
    if (!this.policy.canListInClass(auth, schoolId)) {
      throw new AssignmentForbiddenException();
    }

    const isManager = await this.isManagerOfClassById(auth, schoolId, classId);
    const isActiveStudent =
      hasRole(auth, MembershipRole.STUDENT) &&
      auth.principal.membershipStatus === MembershipStatus.ACTIVE
        ? await this.classRepo.hasActiveStudentEnrollment(
            schoolId,
            classId,
            auth.principal.userId,
          )
        : false;

    if (!isManager && !isActiveStudent) {
      throw new AssignmentNotFoundException();
    }

    const effectiveStatus: ListAssignmentsOptions["status"] = hasRole(
      auth,
      MembershipRole.STUDENT,
    )
      ? "PUBLISHED"
      : query.status;

    const options: ListAssignmentsOptions = {
      classId,
      limit: query.limit,
      ...(effectiveStatus ? { status: effectiveStatus } : {}),
      ...(query.cursor ? { cursor: query.cursor } : {}),
    };

    const result = await this.assignmentRepo.list(schoolId, options);
    const items = result.items.filter((summary) => {
      if (hasRole(auth, MembershipRole.STUDENT)) {
        return this.policy.isStudentVisible(
          summary,
          this.clock,
          isActiveStudent,
        );
      }
      return true;
    });

    return {
      items: items.map(toAssignmentSummaryResponse),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  async updateDraft(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
    dto: UpdateAssignmentDto,
  ) {
    const assignment = await this.requireManageableAssignment(
      auth,
      schoolId,
      assignmentId,
    );

    if (assignment.status !== "DRAFT") {
      throw new AssignmentConflictException("只有草稿状态可以编辑");
    }

    const publishAt = dto.publishAt ?? assignment.publishAt;
    const dueAt = dto.dueAt ?? assignment.dueAt;
    this.validateSchedule(publishAt, dueAt);

    const now = this.clock.now();
    const updated: Assignment = {
      ...assignment,
      ...(dto.title ? { title: dto.title } : {}),
      ...(dto.teacherNotes !== undefined
        ? { teacherNotes: dto.teacherNotes }
        : {}),
      ...(dto.studentNotes !== undefined
        ? { studentNotes: dto.studentNotes }
        : {}),
      ...(dto.publishAt ? { publishAt: dto.publishAt } : {}),
      ...(dto.dueAt ? { dueAt: dto.dueAt } : {}),
      ...(dto.latePolicy ? { latePolicy: dto.latePolicy } : {}),
      ...(dto.retryPolicy
        ? {
            retryPolicy: {
              maxAttempts:
                dto.retryPolicy.maxAttempts ??
                assignment.retryPolicy.maxAttempts,
              allowRetest:
                dto.retryPolicy.allowRetest ??
                assignment.retryPolicy.allowRetest,
            },
          }
        : {}),
      updatedAt: now,
    };

    const saved = await this.assignmentRepo.save(updated, {
      generateId: false,
    });
    return toAssignmentResponse(saved);
  }

  async publishAssignment(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
  ) {
    const assignment = await this.requireManageableAssignment(
      auth,
      schoolId,
      assignmentId,
    );

    if (assignment.status === "PUBLISHED") {
      return toAssignmentResponse(assignment);
    }

    if (assignment.status !== "DRAFT") {
      throw new AssignmentConflictException("只有草稿可以发布");
    }

    await this.requirePublishedCourseVersion(
      schoolId,
      assignment.courseVersionId,
    );
    this.validateSchedule(assignment.publishAt, assignment.dueAt);

    const published: Assignment = {
      ...assignment,
      status: "PUBLISHED",
      publishedAt: this.clock.now(),
      updatedAt: this.clock.now(),
    };

    const saved = await this.assignmentRepo.save(published, {
      generateId: false,
    });
    return toAssignmentResponse(saved);
  }

  async closeAssignment(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
  ) {
    const assignment = await this.requireManageableAssignment(
      auth,
      schoolId,
      assignmentId,
    );

    if (assignment.status !== "PUBLISHED") {
      throw new AssignmentConflictException("只能关闭已发布任务");
    }

    const closed: Assignment = {
      ...assignment,
      status: "CLOSED",
      closedAt: this.clock.now(),
      updatedAt: this.clock.now(),
    };

    const saved = await this.assignmentRepo.save(closed, { generateId: false });
    return toAssignmentResponse(saved);
  }

  async archiveAssignment(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
  ) {
    const assignment = await this.requireManageableAssignment(
      auth,
      schoolId,
      assignmentId,
    );

    if (assignment.status === "ARCHIVED") {
      return toAssignmentResponse(assignment);
    }

    if (assignment.status !== "PUBLISHED" && assignment.status !== "CLOSED") {
      throw new AssignmentConflictException("只能归档已发布或已关闭任务");
    }

    const archived: Assignment = {
      ...assignment,
      status: "ARCHIVED",
      updatedAt: this.clock.now(),
    };

    const saved = await this.assignmentRepo.save(archived, {
      generateId: false,
    });
    return toAssignmentResponse(saved);
  }

  private async requireManageableAssignment(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
  ): Promise<Assignment> {
    const assignment = await this.assignmentRepo.findById(
      schoolId,
      assignmentId,
    );
    if (!assignment) {
      throw new AssignmentNotFoundException();
    }

    const isManager = await this.isManagerOfClassById(
      auth,
      schoolId,
      assignment.classId,
    );
    if (!this.policy.canManage(auth, assignment, isManager)) {
      throw new AssignmentNotFoundException();
    }

    return assignment;
  }

  private async isManagerOfClassById(
    auth: AuthContext,
    schoolId: string,
    classId: string,
  ): Promise<boolean> {
    const visibleClass = await this.classRepo.findVisibleClassById({
      schoolId,
      classId,
      actor: {
        userId: auth.principal.userId,
        roles: auth.principal.roles,
      },
    });
    return visibleClass !== null;
  }

  private isManagerOfClass(
    auth: AuthContext,
    classItem: {
      readonly schoolId: string;
      readonly teacherUserIds: readonly string[];
    },
  ): boolean {
    if (hasRole(auth, MembershipRole.SCHOOL_ADMIN)) {
      return auth.tenant.schoolId === classItem.schoolId;
    }

    if (hasRole(auth, MembershipRole.TEACHER)) {
      return (
        auth.tenant.schoolId === classItem.schoolId &&
        classItem.teacherUserIds.includes(auth.principal.userId)
      );
    }

    return false;
  }

  private async requirePublishedCourseVersion(
    schoolId: string,
    courseVersionId: string,
  ): Promise<void> {
    const version = await this.courseRepo.findById(schoolId, courseVersionId);
    if (!version) {
      throw new AssignmentValidationException("课程版本不存在或不属于本校");
    }

    if (version.status === "RETIRED") {
      throw new AssignmentValidationException("课程版本已停用，无法使用");
    }

    if (version.status !== "PUBLISHED") {
      throw new AssignmentValidationException(
        "课程版本未发布，无法作为正式任务",
      );
    }
  }

  private validateSchedule(
    publishAt: Date | undefined,
    dueAt: Date | undefined,
  ): void {
    if (publishAt && dueAt && dueAt.getTime() < publishAt.getTime()) {
      throw new AssignmentValidationException("截止时间不能早于发布时间");
    }
  }
}
