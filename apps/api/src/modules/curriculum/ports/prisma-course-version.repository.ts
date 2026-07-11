import { Injectable } from "@nestjs/common";
import { Prisma } from "@yuzan/database";
import { PrismaService } from "../../../shared/database/prisma.service.js";
import type {
  Activity,
  ActivityType,
  BilingualContent,
  CourseVersion,
  CourseVersionStatus,
  CourseVersionSummary,
  Lesson,
  ResourceRef,
  Unit,
} from "../domain/course-version.types.js";
import { toSummary } from "../domain/course-version.types.js";
import {
  CurriculumConflictException,
  CurriculumNotFoundException,
  CurriculumRepositoryUnavailableException,
} from "../domain/curriculum.errors.js";
import type {
  CourseVersionRepositoryPort,
  ListCourseVersionsOptions,
  PaginatedResult,
  SaveCourseVersionOptions,
} from "./course-version-repository.port.js";

const PUBLISHABLE_STATUSES: CourseVersionStatus[] = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
];

const fullCourseVersionInclude = {
  course: true,
  units: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      lessons: {
        orderBy: { sortOrder: "asc" as const },
        include: {
          activities: {
            orderBy: { sortOrder: "asc" as const },
            include: { resources: true },
          },
        },
      },
    },
  },
} as const satisfies Prisma.CourseVersionInclude;

const courseVersionWithCourseAndUnitsArgs = {
  include: fullCourseVersionInclude,
} as const;

type CourseVersionWithCourseAndUnits = Prisma.CourseVersionGetPayload<
  typeof courseVersionWithCourseAndUnitsArgs
>;

function handleDbError(error: unknown): never {
  if (
    error instanceof CurriculumConflictException ||
    error instanceof CurriculumNotFoundException
  ) {
    throw error;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new CurriculumConflictException("课程版本标识或版本号冲突");
    }
  }
  throw new CurriculumRepositoryUnavailableException();
}

@Injectable()
export class PrismaCourseVersionRepository
  implements CourseVersionRepositoryPort
{
  constructor(private readonly prisma: PrismaService) {}

  async nextVersion(schoolId: string, courseId: string): Promise<number> {
    try {
      const result = await this.prisma.courseVersion.aggregate({
        where: {
          schoolId,
          courseId,
          course: { deletedAt: null, school: { isActive: true, deletedAt: null } },
        },
        _max: { version: true },
      });
      return (result._max.version ?? 0) + 1;
    } catch (error) {
      handleDbError(error);
    }
  }

  async save(
    version: CourseVersion,
    options?: SaveCourseVersionOptions,
  ): Promise<CourseVersion> {
    const generateVersion = options?.generateVersion ?? false;
    const versionNumber = generateVersion
      ? await this.nextVersion(version.schoolId, version.courseId)
      : version.version;

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.validateOwnership(tx, version);
        const existing = await tx.courseVersion.findFirst({
          where: {
            id: version.id,
            schoolId: version.schoolId,
            course: { deletedAt: null },
          },
          select: { id: true },
        });
        const existingCourse = await tx.course.findFirst({
          where: {
            id: version.courseId,
            schoolId: version.schoolId,
            authorUserId: version.authorUserId,
            deletedAt: null,
          },
          select: { id: true },
        });

        if (existing) {
          if (!options?.expectedUpdatedAt) {
            throw new CurriculumConflictException(
              "Updating a course draft requires expectedUpdatedAt",
            );
          }
          const claimed = await tx.courseVersion.updateMany({
            where: {
              id: version.id,
              schoolId: version.schoolId,
              updatedAt: options.expectedUpdatedAt,
              status: { in: ["DRAFT", "CHANGES_REQUESTED"] },
              course: {
                schoolId: version.schoolId,
                authorUserId: version.authorUserId,
                deletedAt: null,
                school: { isActive: true, deletedAt: null },
              },
            },
            data: {
              version: versionNumber,
              status: version.status,
              title: version.title,
              description: this.toNullable(version.description),
              gradeBand: this.toNullable(version.gradeBand),
              locale: version.locale,
              dialect: this.toNullable(version.dialect),
              objectives: this.toJson(version.objectives),
              submittedAt: this.toNullable(version.submittedAt),
              approvedAt: this.toNullable(version.approvedAt),
              publishedAt: this.toNullable(version.publishedAt),
              retiredAt: this.toNullable(version.retiredAt),
              updatedAt: version.updatedAt,
            },
          });
          if (claimed.count !== 1) {
            throw new CurriculumConflictException(
              "Course draft changed or is no longer editable",
            );
          }
          await tx.unit.deleteMany({ where: { courseVersionId: version.id } });
          await tx.courseVersion.update({
            where: { id: version.id },
            data: { units: { create: this.buildUnitsCreateInput(version.units) } },
          });
          await tx.course.updateMany({
            where: {
              id: version.courseId,
              schoolId: version.schoolId,
              authorUserId: version.authorUserId,
              deletedAt: null,
            },
            data: { title: version.title },
          });
        } else {
          if (!existingCourse) {
            await tx.course.create({
              data: {
                id: version.courseId,
                schoolId: version.schoolId,
                authorUserId: version.authorUserId,
                stableKey: version.courseId,
                title: version.title,
              },
            });
          }
          await tx.courseVersion.create({
            data: {
              id: version.id,
              schoolId: version.schoolId,
              courseId: version.courseId,
              version: versionNumber,
              status: version.status,
              title: version.title,
              description: this.toNullable(version.description),
              gradeBand: this.toNullable(version.gradeBand),
              locale: version.locale,
              dialect: this.toNullable(version.dialect),
              objectives: this.toJson(version.objectives),
              submittedAt: this.toNullable(version.submittedAt),
              approvedAt: this.toNullable(version.approvedAt),
              publishedAt: this.toNullable(version.publishedAt),
              retiredAt: this.toNullable(version.retiredAt),
              createdAt: version.createdAt,
              updatedAt: version.updatedAt,
              units: { create: this.buildUnitsCreateInput(version.units) },
            },
          });
        }

        const saved = await this.findByIdInTx(tx, version.schoolId, version.id);
        if (!saved) {
          throw new CurriculumRepositoryUnavailableException(
            "保存课程版本后未能读取",
          );
        }
        return saved;
      });
    } catch (error) {
      handleDbError(error);
    }
  }

  async findById(
    schoolId: string,
    courseVersionId: string,
  ): Promise<CourseVersion | null> {
    try {
      const row = await this.prisma.courseVersion.findFirst({
        where: {
          id: courseVersionId,
          schoolId,
          course: { deletedAt: null, school: { isActive: true, deletedAt: null } },
        },
        include: fullCourseVersionInclude,
      });
      return row ? this.mapToDomain(row) : null;
    } catch (error) {
      handleDbError(error);
    }
  }

  async list(
    schoolId: string,
    options: ListCourseVersionsOptions,
  ): Promise<PaginatedResult<CourseVersionSummary>> {
    try {
      const where: Prisma.CourseVersionWhereInput = {
        schoolId,
        course: { deletedAt: null, school: { isActive: true, deletedAt: null } },
      };
      if (options.status) {
        where.status = options.status;
      }

      const take = options.limit;
      const skip = options.cursor ? parseInt(options.cursor, 10) : 0;

      const rows = await this.prisma.courseVersion.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: take + 1,
      });

      const hasMore = rows.length > take;
      const items = rows.slice(0, take).map((row) => ({
        id: row.id,
        courseId: row.courseId,
        version: row.version,
        title: row.title,
        status: row.status as CourseVersionStatus,
        gradeBand: row.gradeBand ?? null,
        updatedAt: row.updatedAt,
      }));
      const nextCursor = hasMore ? String(skip + take) : null;

      return { items, nextCursor, hasMore };
    } catch (error) {
      handleDbError(error);
    }
  }

  async findPublishedByCourseId(
    schoolId: string,
    courseId: string,
  ): Promise<CourseVersion | null> {
    try {
      const row = await this.prisma.courseVersion.findFirst({
        where: {
          schoolId,
          courseId,
          status: "PUBLISHED",
          course: { deletedAt: null, school: { isActive: true, deletedAt: null } },
        },
        include: fullCourseVersionInclude,
      });
      return row ? this.mapToDomain(row) : null;
    } catch (error) {
      handleDbError(error);
    }
  }

  async findDraftsByCourseId(
    schoolId: string,
    courseId: string,
  ): Promise<readonly CourseVersion[]> {
    try {
      const rows = await this.prisma.courseVersion.findMany({
        where: {
          schoolId,
          courseId,
          status: "DRAFT",
          course: { deletedAt: null, school: { isActive: true, deletedAt: null } },
        },
        include: fullCourseVersionInclude,
      });
      return rows.map((row) => this.mapToDomain(row));
    } catch (error) {
      handleDbError(error);
    }
  }

  async publish(
    schoolId: string,
    courseVersionId: string,
    publishedAt: Date,
  ): Promise<CourseVersion | null> {
    try {
      const existing = await this.prisma.courseVersion.findFirst({
        where: { id: courseVersionId, schoolId },
        select: { status: true },
      });

      if (!existing) {
        return null;
      }

      if (existing.status === "PUBLISHED") {
        return this.findById(schoolId, courseVersionId);
      }

      if (existing.status === "RETIRED") {
        return null;
      }

      const result = await this.prisma.courseVersion.updateMany({
        where: {
          id: courseVersionId,
          schoolId,
          status: { in: PUBLISHABLE_STATUSES },
        },
        data: {
          status: "PUBLISHED",
          publishedAt,
          updatedAt: new Date(),
        },
      });

      if (result.count === 0) {
        return null;
      }

      return this.findById(schoolId, courseVersionId);
    } catch (error) {
      handleDbError(error);
    }
  }

  async retire(
    schoolId: string,
    courseVersionId: string,
    retiredAt: Date,
  ): Promise<CourseVersion | null> {
    try {
      const result = await this.prisma.courseVersion.updateMany({
        where: {
          id: courseVersionId,
          schoolId,
          status: "PUBLISHED",
        },
        data: {
          status: "RETIRED",
          retiredAt,
          updatedAt: new Date(),
        },
      });

      if (result.count === 0) {
        return null;
      }

      return this.findById(schoolId, courseVersionId);
    } catch (error) {
      handleDbError(error);
    }
  }

  private async validateOwnership(
    tx: Prisma.TransactionClient,
    version: CourseVersion,
  ): Promise<void> {
    const [school, authorMembership] = await Promise.all([
      tx.school.findFirst({
        where: { id: version.schoolId, isActive: true, deletedAt: null },
        select: { id: true },
      }),
      tx.membership.findFirst({
        where: {
          schoolId: version.schoolId,
          userId: version.authorUserId,
          status: "ACTIVE",
          role: { in: ["TEACHER", "SCHOOL_ADMIN"] },
          user: { status: "ACTIVE" },
          school: { isActive: true, deletedAt: null },
        },
        select: { id: true },
      }),
    ]);
    if (!school || !authorMembership) {
      throw new CurriculumNotFoundException();
    }

    const resourceIds = [...new Set(
      version.units.flatMap((unit) =>
        unit.lessons.flatMap((lesson) =>
          lesson.activities.flatMap((activity) =>
            activity.resources.map((resource) => resource.id),
          ),
        ),
      ),
    )];
    if (resourceIds.length === 0) return;

    const resources = await tx.resource.findMany({
      where: {
        id: { in: resourceIds },
        deletedAt: null,
        OR: [{ schoolId: version.schoolId }, { schoolId: null }],
      },
      select: { id: true },
    });
    if (resources.length !== resourceIds.length) {
      throw new CurriculumNotFoundException();
    }
  }

  private async findByIdInTx(
    tx: Prisma.TransactionClient,
    schoolId: string,
    courseVersionId: string,
  ): Promise<CourseVersion | null> {
    const row = await tx.courseVersion.findFirst({
      where: {
        id: courseVersionId,
        schoolId,
        course: { deletedAt: null, school: { isActive: true, deletedAt: null } },
      },
      include: fullCourseVersionInclude,
    });
    return row ? this.mapToDomain(row) : null;
  }

  private toJson(
    value: unknown,
  ): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
    if (value === undefined || value === null) {
      return Prisma.DbNull;
    }
    return value as Prisma.InputJsonValue;
  }

  private toNullable<T>(value: T | undefined): T | null {
    return value === undefined ? null : value;
  }

  private buildUnitsCreateInput(
    units: readonly Unit[],
  ): Prisma.UnitCreateWithoutCourseVersionInput[] {
    return units.map((unit) => this.buildUnitCreateInput(unit));
  }

  private buildUnitCreateInput(
    unit: Unit,
  ): Prisma.UnitCreateWithoutCourseVersionInput {
    return {
      id: unit.id,
      title: unit.title,
      sortOrder: unit.sortOrder,
      lessons: {
        create: unit.lessons.map((lesson) =>
          this.buildLessonCreateInput(lesson),
        ),
      },
    };
  }

  private buildLessonCreateInput(
    lesson: Lesson,
  ): Prisma.LessonCreateWithoutUnitInput {
    return {
      id: lesson.id,
      title: lesson.title,
      sortOrder: lesson.sortOrder,
      activities: {
        create: lesson.activities.map((activity) =>
          this.buildActivityCreateInput(activity),
        ),
      },
    };
  }

  private buildActivityCreateInput(
    activity: Activity,
  ): Prisma.LearningActivityCreateWithoutLessonInput {
    return {
      id: activity.id,
      type: activity.type,
      title: activity.title,
      instruction: this.toJson(activity.instruction),
      sortOrder: activity.sortOrder,
      required: activity.required,
      completionRule: this.toJson(activity.completionRule),
      content: this.toJson(activity.content),
      teacherNotes: this.toJson(activity.teacherNotes),
      studentNotes: this.toJson(activity.studentNotes),
      resources: {
        create: activity.resources.map((resource) =>
          this.buildResourceCreateInput(resource),
        ),
      },
    };
  }

  private buildResourceCreateInput(
    resource: ResourceRef,
  ): Prisma.ActivityResourceUncheckedCreateWithoutActivityInput {
    return {
      resourceId: resource.id,
      purpose: "primary",
      meta: this.toJson({
        snapshot: {
          id: resource.id,
          kind: resource.kind,
          objectKey: resource.objectKey,
          uri: resource.uri,
          mediaType: resource.mediaType,
          byteSize: resource.byteSize,
          altText: resource.altText,
          language: resource.language,
          source: resource.source,
          rightsStatus: resource.rightsStatus,
          rightsNote: resource.rightsNote,
        },
      }),
    };
  }

  private mapToDomain(row: CourseVersionWithCourseAndUnits): CourseVersion {
    return {
      id: row.id,
      schoolId: row.schoolId,
      courseId: row.courseId,
      authorUserId: row.course.authorUserId,
      version: row.version,
      status: row.status as CourseVersionStatus,
      title: row.title,
      description: row.description ?? undefined,
      gradeBand: row.gradeBand ?? undefined,
      locale: row.locale,
      dialect: row.dialect ?? undefined,
      objectives: (row.objectives as readonly BilingualContent[] | null) ?? [],
      units: row.units.map((unit) => this.mapUnit(unit)),
      submittedAt: row.submittedAt ?? undefined,
      approvedAt: row.approvedAt ?? undefined,
      publishedAt: row.publishedAt ?? undefined,
      retiredAt: row.retiredAt ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapUnit(
    unit: Prisma.UnitGetPayload<{
      include: {
        lessons: {
          include: {
            activities: {
              include: { resources: true };
            };
          };
        };
      };
    }>,
  ): Unit {
    return {
      id: unit.id,
      title: unit.title,
      sortOrder: unit.sortOrder,
      lessons: unit.lessons.map((lesson) => this.mapLesson(lesson)),
    };
  }

  private mapLesson(
    lesson: Prisma.LessonGetPayload<{
      include: {
        activities: {
          include: { resources: true };
        };
      };
    }>,
  ): Lesson {
    return {
      id: lesson.id,
      title: lesson.title,
      sortOrder: lesson.sortOrder,
      activities: lesson.activities.map((activity) =>
        this.mapActivity(activity),
      ),
    };
  }

  private mapActivity(
    activity: Prisma.LearningActivityGetPayload<{
      include: { resources: true };
    }>,
  ): Activity {
    return {
      id: activity.id,
      type: activity.type as ActivityType,
      title: activity.title,
      instruction: activity.instruction
        ? (activity.instruction as unknown as BilingualContent)
        : undefined,
      sortOrder: activity.sortOrder,
      required: activity.required,
      completionRule: activity.completionRule ?? undefined,
      content: activity.content ?? undefined,
      teacherNotes: activity.teacherNotes
        ? (activity.teacherNotes as unknown as BilingualContent)
        : undefined,
      studentNotes: activity.studentNotes
        ? (activity.studentNotes as unknown as BilingualContent)
        : undefined,
      resources: activity.resources.map((resource) =>
        this.mapResourceRef(resource),
      ),
    };
  }

  private mapResourceRef(
    resource: Prisma.ActivityResourceGetPayload<{}>,
  ): ResourceRef {
    const meta = resource.meta as { snapshot?: ResourceRef } | null;
    const snapshot = meta?.snapshot;
    return {
      id: resource.resourceId,
      kind: snapshot?.kind ?? "OTHER",
      objectKey: snapshot?.objectKey ?? "",
      uri: snapshot?.uri,
      mediaType: snapshot?.mediaType ?? "",
      byteSize: snapshot?.byteSize ?? 0,
      altText: snapshot?.altText,
      language: snapshot?.language,
      source: snapshot?.source,
      rightsStatus: snapshot?.rightsStatus ?? "UNKNOWN",
      rightsNote: snapshot?.rightsNote,
    };
  }
}
