import { Inject, Injectable } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import { LearningForbiddenException } from "./domain/learning.errors.js";
import type {
  ActivityProgressRecord,
  LearningActivityDetail,
  LearningTask,
  UpdateProgressInput,
} from "./domain/learning.types.js";
import {
  toActivityProgressResponse,
  toLearningActivityResponse,
} from "./dto/activity-progress.response.js";
import { toLearningTaskResponse } from "./dto/learning-task.response.js";
import type { LearningRepositoryPort } from "./ports/learning-repository.port.js";
import { LEARNING_REPOSITORY } from "./ports/learning-repository.port.js";
import type { ClassEnrollmentLookupPort } from "../classes/ports/class-enrollment-lookup.port.js";
import { CLASS_ENROLLMENT_LOOKUP } from "../classes/ports/class-enrollment-lookup.port.js";
import type { AssignmentLookupPort } from "../assignments/ports/assignment-lookup.port.js";
import { ASSIGNMENT_LOOKUP } from "../assignments/ports/assignment-lookup.port.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import { LearningPolicy } from "./learning.policy.js";

@Injectable()
export class LearningService {
  private readonly policy = new LearningPolicy();

  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly learningRepo: LearningRepositoryPort,
    @Inject(CLASS_ENROLLMENT_LOOKUP)
    private readonly enrollmentLookup: ClassEnrollmentLookupPort,
    @Inject(ASSIGNMENT_LOOKUP)
    private readonly assignmentLookup: AssignmentLookupPort,
    private readonly prisma: PrismaService,
  ) {}

  async listTasks(auth: AuthContext, schoolId: string) {
    if (!this.policy.canViewTasks(auth, schoolId)) {
      throw new LearningForbiddenException();
    }

    // Get user's enrollments to find their classes
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        userId: auth.principal.userId,
        schoolId,
        status: "ACTIVE",
        role: "STUDENT",
      },
      select: { id: true, classId: true },
    });

    const enrollmentIds = enrollments.map((e) => e.id);

    const tasks: LearningTask[] = [];

    for (const enrollmentId of enrollmentIds) {
      const assignments = await this.assignmentLookup.listByEnrollment(
        schoolId,
        enrollmentId,
      );

      for (const assignment of assignments) {
        // Get full assignment to access courseVersionId
        const fullAssignment = await this.prisma.assignment.findFirst({
          where: { id: assignment.id, schoolId, deletedAt: null },
          select: { courseVersionId: true },
        });

        // Get course title from course version
        let courseTitle = "";
        if (fullAssignment?.courseVersionId) {
          const courseVersion = await this.prisma.courseVersion.findFirst({
            where: { id: fullAssignment.courseVersionId },
            select: { title: true },
          });
          courseTitle = courseVersion?.title ?? "";
        }

        tasks.push({
          assignmentId: assignment.id,
          title: assignment.title,
          status: assignment.status,
          dueAt: assignment.dueAt,
          courseVersionId: fullAssignment?.courseVersionId ?? "",
          courseTitle,
        });
      }
    }

    return tasks.map(toLearningTaskResponse);
  }

  async getTaskDetail(
    auth: AuthContext,
    schoolId: string,
    assignmentId: string,
  ) {
    if (!this.policy.canViewTasks(auth, schoolId)) {
      throw new LearningForbiddenException();
    }

    const assignment = await this.assignmentLookup.findSummaryById(schoolId, assignmentId);
    if (!assignment) {
      throw new LearningForbiddenException("作业不存在");
    }

    // Get full assignment to access courseVersionId
    const fullAssignment = await this.prisma.assignment.findFirst({
      where: { id: assignmentId, schoolId, deletedAt: null },
      select: { courseVersionId: true },
    });

    // Verify student is a target of this assignment
    const target = await this.prisma.assignmentTarget.findFirst({
      where: {
        assignmentId,
        schoolId,
        OR: [
          {
            targetType: "CLASS",
            class: {
              enrollments: {
                some: {
                  userId: auth.principal.userId,
                  role: "STUDENT",
                  status: "ACTIVE",
                },
              },
            },
          },
          {
            targetType: "STUDENT",
            enrollment: {
              userId: auth.principal.userId,
              status: "ACTIVE",
            },
          },
        ],
      },
    });

    if (!target) {
      throw new LearningForbiddenException();
    }

    if (!fullAssignment?.courseVersionId) {
      return [];
    }

    // Get CourseVersion with units/lessons/activities
    const courseVersion = await this.prisma.courseVersion.findFirst({
      where: { id: fullAssignment.courseVersionId, schoolId },
      include: {
        units: {
          orderBy: { sortOrder: "asc" },
          include: {
            lessons: {
              orderBy: { sortOrder: "asc" },
              include: {
                activities: {
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
          },
        },
      },
    });

    if (!courseVersion) {
      return [];
    }

    // Get user's enrollment for progress lookup
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        userId: auth.principal.userId,
        schoolId,
        status: "ACTIVE",
        role: "STUDENT",
      },
      select: { id: true },
    });

    const activities: LearningActivityDetail[] = [];

    for (const unit of courseVersion.units) {
      for (const lesson of unit.lessons) {
        for (const activity of lesson.activities) {
          let progress: ActivityProgressRecord | undefined;

          if (enrollment) {
            const progressRecord = await this.learningRepo.findProgress(
              activity.id,
              enrollment.id,
            );
            progress = progressRecord ?? undefined;
          }

          activities.push({
            activityId: activity.id,
            title: activity.title,
            type: activity.type,
            ...(activity.instruction
              ? {
                  instruction:
                    typeof activity.instruction === "object" &&
                    activity.instruction !== null &&
                    "originalText" in activity.instruction
                      ? (activity.instruction as { originalText: string }).originalText
                      : String(activity.instruction),
                }
              : {}),
            sortOrder: activity.sortOrder,
            required: activity.required,
            ...(progress ? { progress } : {}),
          });
        }
      }
    }

    return activities.map(toLearningActivityResponse);
  }

  async getProgress(
    auth: AuthContext,
    schoolId: string,
    activityId: string,
    enrollmentId: string,
  ) {
    if (!this.policy.canViewTasks(auth, schoolId)) {
      throw new LearningForbiddenException();
    }

    // Verify enrollmentId belongs to user
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        id: enrollmentId,
        userId: auth.principal.userId,
        schoolId,
        status: "ACTIVE",
      },
    });

    if (!enrollment) {
      throw new LearningForbiddenException();
    }

    const progress = await this.learningRepo.findProgress(
      activityId,
      enrollmentId,
    );

    if (!progress) {
      return null;
    }

    return toActivityProgressResponse(progress);
  }

  async updateProgress(
    auth: AuthContext,
    schoolId: string,
    activityId: string,
    enrollmentId: string,
    input: Omit<UpdateProgressInput, "schoolId" | "activityId" | "enrollmentId">,
  ) {
    if (!this.policy.canUpdateProgress(auth, schoolId)) {
      throw new LearningForbiddenException();
    }

    // Verify enrollmentId belongs to user
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        id: enrollmentId,
        userId: auth.principal.userId,
        schoolId,
        status: "ACTIVE",
      },
    });

    if (!enrollment) {
      throw new LearningForbiddenException();
    }

    const result = await this.learningRepo.upsertProgress({
      schoolId,
      activityId,
      enrollmentId,
      position: input.position,
      completed: input.completed,
      ...(input.expectedRevision !== undefined ? { expectedRevision: input.expectedRevision } : {}),
    });

    return toActivityProgressResponse(result);
  }
}
