import { ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { AuthContext } from "../../common/security/auth.types.js";
import { MembershipRole } from "../../common/security/membership-role.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import type { CreatePilotFeedbackDto, ListPilotFeedbackDto, UpdatePilotFeedbackStatusDto } from "./dto/pilot-feedback.dto.js";

type ReporterRole = "STUDENT" | "TEACHER" | "SCHOOL_ADMIN";

interface ValidatedFeedbackContext {
  sessionId?: string;
  assessmentItemId?: string;
  questionVersionId?: string;
}

@Injectable()
export class PilotFeedbackService {
  private readonly logger = new Logger(PilotFeedbackService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(auth: AuthContext, schoolId: string, dto: CreatePilotFeedbackDto) {
    this.assertSchool(auth, schoolId);
    const reporterRole = this.reporterRole(auth);
    const context = await this.validateContext(auth, schoolId, dto.sessionId, dto.assessmentItemId);
    const row = await this.prisma.pilotFeedback.create({
      data: {
        schoolId,
        reporterUserId: auth.principal.userId,
        reporterRole,
        category: dto.category,
        message: dto.message,
        ...(dto.currentPath ? { pageContext: dto.currentPath } : {}),
        ...(context.sessionId ? { sessionId: context.sessionId } : {}),
        ...(context.assessmentItemId ? { assessmentItemId: context.assessmentItemId } : {}),
        ...(context.questionVersionId ? { questionVersionId: context.questionVersionId } : {}),
      },
    });
    this.logger.log({ event: "pilot_feedback_created", feedbackId: row.id, schoolId, category: row.category, status: row.status });
    return { feedbackId: row.id, status: row.status, createdAt: row.createdAt.toISOString() };
  }

  async mine(auth: AuthContext, schoolId: string) {
    this.assertSchool(auth, schoolId);
    const rows = await this.prisma.pilotFeedback.findMany({
      where: { schoolId, reporterUserId: auth.principal.userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      select: { id: true, category: true, status: true, message: true, createdAt: true, resolutionNote: true, resolvedAt: true },
    });
    return { items: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() ?? null })) };
  }

  async list(auth: AuthContext, schoolId: string, query: ListPilotFeedbackDto) {
    this.assertAdmin(auth, schoolId);
    const limit = query.limit ?? 20;
    const rows = await this.prisma.pilotFeedback.findMany({
      where: { schoolId, ...(query.status ? { status: query.status } : {}), ...(query.category ? { category: query.category } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: {
        id: true, category: true, status: true, message: true, pageContext: true, sessionId: true, assessmentItemId: true, questionVersionId: true, createdAt: true, resolutionNote: true, resolvedAt: true,
        reporterRole: true, reporter: { select: { displayName: true } },
      },
    });
    const page = rows.slice(0, limit);
    return {
      items: page.map((row) => ({
        id: row.id, category: row.category, status: row.status, message: row.message, pageContext: row.pageContext,
        context: { sessionId: row.sessionId, assessmentItemId: row.assessmentItemId, questionVersionId: row.questionVersionId },
        reporter: { displayName: row.reporter.displayName, role: row.reporterRole },
        createdAt: row.createdAt.toISOString(), resolutionNote: row.resolutionNote, resolvedAt: row.resolvedAt?.toISOString() ?? null,
      })),
      nextCursor: rows.length > limit ? page.at(-1)?.id ?? null : null,
    };
  }

  async updateStatus(auth: AuthContext, schoolId: string, feedbackId: string, dto: UpdatePilotFeedbackStatusDto) {
    this.assertAdmin(auth, schoolId);
    const current = await this.prisma.pilotFeedback.findFirst({
      where: { id: feedbackId, schoolId },
      select: { id: true, status: true },
    });
    if (!current) throw new NotFoundException({ code: "PILOT_FEEDBACK_NOT_FOUND", message: "试点反馈不存在" });
    if (dto.status === "ACKNOWLEDGED" && current.status === "RESOLVED") {
      throw new ConflictException({ code: "PILOT_FEEDBACK_STATUS_CONFLICT", message: "已解决的反馈不能退回已知悉" });
    }
    const row = await this.prisma.pilotFeedback.update({
      where: { id: feedbackId },
      data: {
        status: dto.status,
        handledByUserId: auth.principal.userId,
        ...(dto.status === "ACKNOWLEDGED"
          ? { resolutionNote: null }
          : dto.resolutionNote
            ? { resolutionNote: dto.resolutionNote }
            : {}),
        ...(dto.status === "RESOLVED" ? { resolvedAt: new Date() } : { resolvedAt: null }),
      },
      select: { id: true, status: true, resolutionNote: true, resolvedAt: true, updatedAt: true },
    });
    this.logger.log({ event: "pilot_feedback_status_updated", feedbackId: row.id, schoolId, fromStatus: current.status, toStatus: row.status });
    return { ...row, resolvedAt: row.resolvedAt?.toISOString() ?? null, updatedAt: row.updatedAt.toISOString() };
  }

  private assertSchool(auth: AuthContext, schoolId: string) {
    if (auth.tenant.schoolId !== schoolId) throw new ForbiddenException({ code: "PILOT_FORBIDDEN", message: "无权访问该学校试点数据" });
  }

  private assertAdmin(auth: AuthContext, schoolId: string) {
    this.assertSchool(auth, schoolId);
    if (!auth.principal.roles.some((role) => role === MembershipRole.SCHOOL_ADMIN || role === MembershipRole.PLATFORM_ADMIN)) {
      throw new ForbiddenException({ code: "PILOT_ADMIN_REQUIRED", message: "仅学校管理员可执行此操作" });
    }
  }

  private reporterRole(auth: AuthContext): ReporterRole {
    if (auth.principal.roles.includes(MembershipRole.SCHOOL_ADMIN)) return "SCHOOL_ADMIN";
    if (auth.principal.roles.includes(MembershipRole.TEACHER)) return "TEACHER";
    if (auth.principal.roles.includes(MembershipRole.STUDENT)) return "STUDENT";
    throw new ForbiddenException({ code: "PILOT_FEEDBACK_FORBIDDEN", message: "当前角色不能提交试点反馈" });
  }

  private async validateContext(auth: AuthContext, schoolId: string, suppliedSessionId?: string, suppliedItemId?: string): Promise<ValidatedFeedbackContext> {
    if (!suppliedSessionId && !suppliedItemId) return {};
    const item = suppliedItemId
      ? await this.prisma.assessmentItem.findFirst({
        where: { id: suppliedItemId, session: { schoolId } },
        select: { id: true, sessionId: true, questionVersionId: true, session: { select: { classId: true, enrollment: { select: { userId: true, role: true, status: true } } } } },
      })
      : null;
    if (suppliedItemId && !item) {
      throw new ForbiddenException({ code: "PILOT_CONTEXT_FORBIDDEN", message: "反馈上下文无效" });
    }
    const sessionId = item?.sessionId ?? suppliedSessionId;
    if (!sessionId || (suppliedSessionId && item && suppliedSessionId !== item.sessionId)) {
      throw new ForbiddenException({ code: "PILOT_CONTEXT_FORBIDDEN", message: "反馈上下文无效" });
    }
    const session = item ? item.session : await this.prisma.assessmentSession.findFirst({
      where: { id: sessionId, schoolId },
      select: { classId: true, enrollment: { select: { userId: true, role: true, status: true } } },
    });
    if (!session) throw new NotFoundException({ code: "ASSESSMENT_SESSION_NOT_FOUND", message: "测评不存在" });
    const isAdmin = auth.principal.roles.some((role) => role === MembershipRole.SCHOOL_ADMIN || role === MembershipRole.PLATFORM_ADMIN);
    const isOwner = session.enrollment.userId === auth.principal.userId && session.enrollment.role === MembershipRole.STUDENT && session.enrollment.status === "ACTIVE";
    const isTeacher = auth.principal.roles.includes(MembershipRole.TEACHER) && await this.prisma.enrollment.count({ where: { schoolId, classId: session.classId, userId: auth.principal.userId, role: MembershipRole.TEACHER, status: "ACTIVE" } }) > 0;
    if (!isAdmin && !isOwner && !isTeacher) throw new ForbiddenException({ code: "PILOT_CONTEXT_FORBIDDEN", message: "无权关联该测评上下文" });
    return {
      sessionId,
      ...(item ? { assessmentItemId: item.id } : {}),
      ...(item?.questionVersionId ? { questionVersionId: item.questionVersionId } : {}),
    };
  }
}
