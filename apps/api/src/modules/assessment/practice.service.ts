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

const OPEN_ATTEMPT_STATUSES = ["CREATED", "IN_PROGRESS"] as const;

@Injectable()
export class PracticeService {
  constructor(private readonly prisma: PrismaService) {}

  async listForStudent(auth: AuthContext, schoolId: string) {
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
        practiceVersion: { include: { definition: true, sections: { orderBy: { sortOrder: "asc" } } } },
      },
      orderBy: { createdAt: "asc" },
    });

    const attempts = await this.prisma.assessmentSession.findMany({
      where: { schoolId, enrollmentId: enrollment.id, status: { in: [...OPEN_ATTEMPT_STATUSES] } },
      select: { id: true, practiceDefinitionId: true, deliveryId: true, status: true, updatedAt: true },
    });
    const attemptByDelivery = new Map(attempts.filter((a) => a.deliveryId).map((a) => [a.deliveryId!, a]));
    return deliveries.map((delivery) => this.catalogEntry(delivery, attemptByDelivery.get(delivery.id)));
  }

  async getDetail(auth: AuthContext, schoolId: string, definitionId: string) {
    this.assertStudentTenant(auth, schoolId);
    const enrollment = await this.activeEnrollment(auth, schoolId);
    const delivery = await this.findVisibleDelivery(schoolId, definitionId, enrollment.classId, auth.principal.userId);
    if (!delivery) throw new NotFoundException("练习不存在或暂未向你开放");
    const attempt = await this.prisma.assessmentSession.findFirst({
      where: { schoolId, enrollmentId: enrollment.id, deliveryId: delivery.id, status: { in: [...OPEN_ATTEMPT_STATUSES] } },
      select: { id: true, status: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
    return {
      ...this.catalogEntry(delivery, attempt),
      sections: delivery.practiceVersion.sections.map((section) => ({
        title: section.title,
        description: section.description,
        estimatedMinutes: section.estimatedMinutes,
        itemCount: section.items.length,
      })),
      reRecordPolicy: delivery.reRecordPolicy,
      mobilePolicy: delivery.mobilePolicy,
      scoringDisclosure: "录音将进入自动分析和教师复核；服务不可用时会如实显示处理中或不可用，不生成虚假分数。",
    };
  }

  async createOrResume(auth: AuthContext, schoolId: string, definitionId: string) {
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

      const existing = await tx.assessmentSession.findFirst({
        where: { schoolId, enrollmentId: enrollment.id, deliveryId: delivery.id, status: { in: [...OPEN_ATTEMPT_STATUSES] } },
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
        },
      });
      await tx.assessmentItem.createMany({
        data: snapshot.map(({ section, item }, index) => ({
          sessionId: attempt.id,
          questionId: item.questionId,
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
    return { attemptId: result.attempt.id, status: result.attempt.status, resumed: result.resumed };
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

  private catalogEntry(delivery: any, attempt?: { id: string; status: string; updatedAt: Date } | null) {
    const { definition } = delivery.practiceVersion;
    return {
      id: definition.id,
      title: definition.title,
      summary: definition.summary,
      coverAsset: definition.coverAsset,
      difficulty: definition.difficulty,
      estimatedMinutes: definition.estimatedMinutes,
      mode: delivery.mode,
      deadline: delivery.deadline?.toISOString() ?? null,
      sectionCount: delivery.practiceVersion.sections.length,
      attempt: attempt ? { id: attempt.id, status: attempt.status, updatedAt: attempt.updatedAt.toISOString() } : null,
    };
  }

  private assertStudentTenant(auth: AuthContext, schoolId: string) {
    if (auth.tenant.schoolId !== schoolId || !auth.principal.roles.includes("STUDENT" as any)) {
      throw new ForbiddenException("无权访问该学校的学生练习");
    }
  }
}
