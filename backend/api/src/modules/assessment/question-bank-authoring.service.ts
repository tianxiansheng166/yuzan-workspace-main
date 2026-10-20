import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@yuzan/database";
import {
  MembershipRole,
  MembershipStatus,
  type AuthContext,
} from "../../common/security/index.js";
import { PrismaService } from "../../shared/database/prisma.service.js";
import type {
  QuestionBankDraftInputDto,
  UpdateQuestionBankDraftDto,
} from "./dto/question-bank-draft.dto.js";
import type { QuestionBankDraftResponse } from "./dto/question-bank-draft.response.js";

type QuestionBankDraftRow = {
  id: string;
  itemId: string;
  version: number;
  revision: number;
  status: string;
  publishedAt: Date | null;
  deliverySpec: Prisma.JsonValue;
  scoringSpec: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  item: {
    id: string;
    domain: string | null;
    questionType: string | null;
    level: string | null;
    abilityCategory: string | null;
    gradeBand: string | null;
    difficulty: string | null;
    itemType: string;
  };
};

type DraftContent = {
  item: {
    domain: string;
    questionType: string;
    level: string | null;
    abilityCategory: string | null;
    gradeBand: string | null;
    difficulty: string;
    itemType: "CHOICE" | "TEXT";
  };
  deliverySpec: Prisma.InputJsonObject;
  scoringSpec: Prisma.InputJsonObject;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredRecord(
  value: unknown,
  field: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new InternalServerErrorException({
      code: "QUESTION_DRAFT_STORAGE_INVALID",
      message: `已保存的题目草稿缺少有效的${field}`,
    });
  }
  return value;
}

function buildDraftContent(input: QuestionBankDraftInputDto): DraftContent {
  const title = input.title.trim();
  const prompt = input.prompt.trim();
  if (!title || !prompt) {
    throw new BadRequestException({
      code: "QUESTION_DRAFT_INVALID",
      message: "题目标题和题干不能为空",
    });
  }
  if (
    !Number.isInteger(input.maxScore) ||
    input.maxScore < 1 ||
    input.maxScore > 100
  ) {
    throw new BadRequestException({
      code: "QUESTION_DRAFT_INVALID",
      message: "题目分值必须是 1–100 的整数",
    });
  }
  if (
    !["CHOICE", "TEXT"].includes(input.itemType) ||
    !["LISTEN", "SPEAK", "READ", "WRITE"].includes(input.domain) ||
    !["EASY", "MEDIUM", "HARD"].includes(input.difficulty)
  ) {
    throw new BadRequestException({
      code: "QUESTION_DRAFT_INVALID",
      message: "题型、能力方向或难度无效",
    });
  }

  let response: Prisma.InputJsonObject;
  let scoringSpec: Prisma.InputJsonObject;
  if (input.itemType === "CHOICE") {
    const options = input.options ?? [];
    const keys = options.map((option) => option.key);
    if (
      options.length < 2 ||
      options.length > 4 ||
      new Set(keys).size !== keys.length ||
      options.some((option) => !option.text.trim()) ||
      !input.correctOption ||
      !keys.includes(input.correctOption) ||
      (input.acceptedAnswers?.length ?? 0) > 0
    ) {
      throw new BadRequestException({
        code: "QUESTION_DRAFT_INVALID",
        message: "选择题需要 2–4 个不同选项，并指定其中一个正确答案",
      });
    }
    response = {
      type: "CHOICE",
      options: options.map((option) => ({
        key: option.key,
        text: option.text.trim(),
      })),
    };
    scoringSpec = {
      strategy: "EXACT_CHOICE",
      maxScore: input.maxScore,
      referenceAnswer: input.correctOption,
    };
  } else {
    const answers = (input.acceptedAnswers ?? []).map((answer) =>
      answer.trim(),
    );
    if (
      answers.length === 0 ||
      answers.some((answer) => !answer) ||
      new Set(answers).size !== answers.length ||
      (input.options?.length ?? 0) > 0 ||
      input.correctOption !== undefined
    ) {
      throw new BadRequestException({
        code: "QUESTION_DRAFT_INVALID",
        message: "填空题需要至少一个不同的标准答案，且不能包含选择题字段",
      });
    }
    response = { type: "TEXT" };
    scoringSpec = {
      strategy: "ACCEPTED_TEXT",
      maxScore: input.maxScore,
      acceptedAnswers: answers,
    };
  }

  const safeDomain = input.domain;
  const safeItemType = input.itemType;
  return {
    item: {
      domain: safeDomain,
      questionType: `TEACHER_AUTHORED_${safeDomain}_${safeItemType}`,
      level: input.level?.trim() || null,
      abilityCategory: input.abilityCategory?.trim() || null,
      gradeBand: input.gradeBand?.trim() || null,
      difficulty: input.difficulty,
      itemType: safeItemType,
    },
    deliverySpec: {
      instruction: title,
      stimulus: { type: "TEXT", promptText: prompt },
      response,
    },
    scoringSpec,
  };
}

function projectDraft(row: QuestionBankDraftRow): QuestionBankDraftResponse {
  const delivery = requiredRecord(row.deliverySpec, "展示配置");
  const stimulus = requiredRecord(delivery.stimulus, "题干展示");
  const response = requiredRecord(delivery.response, "作答方式");
  const scoring = requiredRecord(row.scoringSpec, "评分配置");
  const rawOptions = response.options;
  const options = Array.isArray(rawOptions)
    ? rawOptions.map((entry) => {
        const option = requiredRecord(entry, "选择题选项");
        if (typeof option.key !== "string" || typeof option.text !== "string") {
          throw new InternalServerErrorException({
            code: "QUESTION_DRAFT_STORAGE_INVALID",
            message: "已保存的选择题选项格式无效",
          });
        }
        return { key: option.key, text: option.text };
      })
    : [];
  const acceptedAnswers = Array.isArray(scoring.acceptedAnswers)
    ? scoring.acceptedAnswers.filter(
        (answer): answer is string => typeof answer === "string",
      )
    : [];

  if (
    typeof delivery.instruction !== "string" ||
    typeof stimulus.promptText !== "string"
  ) {
    throw new InternalServerErrorException({
      code: "QUESTION_DRAFT_STORAGE_INVALID",
      message: "已保存的题目标题或题干格式无效",
    });
  }

  return {
    questionVersionId: row.id,
    itemId: row.itemId,
    version: row.version,
    revision: row.revision,
    status: row.status as QuestionBankDraftResponse["status"],
    reviewStatus: row.status === "DRAFT" ? "NOT_SUBMITTED" : "NOT_TRACKED",
    publishedAt: row.publishedAt?.toISOString() ?? null,
    title: delivery.instruction,
    prompt: stimulus.promptText,
    itemType: row.item.itemType,
    domain: row.item.domain,
    questionType: row.item.questionType,
    gradeBand: row.item.gradeBand,
    level: row.item.level,
    difficulty: row.item.difficulty,
    abilityCategory: row.item.abilityCategory,
    options,
    correctOption:
      typeof scoring.referenceAnswer === "string"
        ? scoring.referenceAnswer
        : null,
    acceptedAnswers,
    maxScore: typeof scoring.maxScore === "number" ? scoring.maxScore : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class QuestionBankAuthoringService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listDrafts(auth: AuthContext, schoolId: string) {
    this.assertTeacherScope(auth, schoolId);
    const rows = await this.prisma.questionBankItemVersion.findMany({
      where: {
        authorUserId: auth.principal.userId,
        item: { is: { schoolId } },
      },
      include: { item: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 100,
    });
    return { items: rows.map((row) => projectDraft(row)) };
  }

  async createDraft(
    auth: AuthContext,
    schoolId: string,
    input: QuestionBankDraftInputDto,
  ) {
    this.assertTeacherScope(auth, schoolId);
    const content = buildDraftContent(input);
    const created = await this.prisma.$transaction(async (tx) =>
      tx.questionBankItem.create({
        data: {
          schoolId,
          stableKey: `TEACHER-AUTHORED-${randomUUID()}`,
          ...content.item,
          versions: {
            create: {
              version: 1,
              revision: 1,
              authorUserId: auth.principal.userId,
              deliverySpec: content.deliverySpec,
              scoringSpec: content.scoringSpec,
              status: "DRAFT",
              publishedAt: null,
            },
          },
        },
        include: { versions: true },
      }),
    );
    const version = created.versions[0];
    if (!version) {
      throw new InternalServerErrorException({
        code: "QUESTION_DRAFT_CREATE_FAILED",
        message: "题目草稿已无法确认保存结果，请刷新列表后重试",
      });
    }
    return projectDraft({ ...version, item: created });
  }

  async getDraft(auth: AuthContext, schoolId: string, versionId: string) {
    this.assertTeacherScope(auth, schoolId);
    const row = await this.prisma.questionBankItemVersion.findFirst({
      where: {
        id: versionId,
        authorUserId: auth.principal.userId,
        item: { is: { schoolId } },
      },
      include: { item: true },
    });
    if (!row) throw this.notFound();
    return projectDraft(row);
  }

  async updateDraft(
    auth: AuthContext,
    schoolId: string,
    versionId: string,
    input: UpdateQuestionBankDraftDto,
  ) {
    this.assertTeacherScope(auth, schoolId);
    const content = buildDraftContent(input);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.questionBankItemVersion.findFirst({
        where: {
          id: versionId,
          authorUserId: auth.principal.userId,
          item: { is: { schoolId } },
        },
        include: { item: true },
      });
      if (!current) throw this.notFound();
      if (current.status !== "DRAFT") {
        throw new ConflictException({
          code: "QUESTION_DRAFT_STATUS_CONFLICT",
          message: "只有 DRAFT 状态的题目可以编辑",
        });
      }
      if (current.revision !== input.expectedRevision) {
        throw this.revisionConflict(current.revision);
      }

      const updated = await tx.questionBankItemVersion.updateMany({
        where: {
          id: versionId,
          authorUserId: auth.principal.userId,
          status: "DRAFT",
          revision: input.expectedRevision,
          item: { is: { schoolId } },
        },
        data: {
          deliverySpec: content.deliverySpec,
          scoringSpec: content.scoringSpec,
          revision: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        const latest = await tx.questionBankItemVersion.findFirst({
          where: {
            id: versionId,
            authorUserId: auth.principal.userId,
            item: { is: { schoolId } },
          },
          select: { revision: true },
        });
        if (!latest) throw this.notFound();
        throw this.revisionConflict(latest.revision);
      }

      const itemUpdate = await tx.questionBankItem.updateMany({
        where: { id: current.itemId, schoolId },
        data: content.item,
      });
      if (itemUpdate.count !== 1) throw this.notFound();

      const row = await tx.questionBankItemVersion.findFirst({
        where: {
          id: versionId,
          authorUserId: auth.principal.userId,
          item: { is: { schoolId } },
        },
        include: { item: true },
      });
      if (!row) throw this.notFound();
      return projectDraft(row);
    });
  }

  private assertTeacherScope(auth: AuthContext, schoolId: string): void {
    if (auth.tenant.schoolId !== schoolId) {
      throw new ForbiddenException({
        code: "FORBIDDEN_TENANT",
        message: "不允许访问该学校的题目",
      });
    }
    if (auth.principal.membershipStatus !== MembershipStatus.ACTIVE) {
      throw new UnauthorizedException({
        code: "UNAUTHENTICATED",
        message: "当前学校身份已失效，请重新登录",
      });
    }
    if (!auth.principal.roles.includes(MembershipRole.TEACHER)) {
      throw new ForbiddenException({
        code: "FORBIDDEN_ROLE",
        message: "只有当前学校教师可以编写题目草稿",
      });
    }
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: "QUESTION_DRAFT_NOT_FOUND",
      message: "题目草稿不存在或不属于当前教师",
    });
  }

  private revisionConflict(currentRevision: number): ConflictException {
    return new ConflictException({
      code: "QUESTION_DRAFT_REVISION_CONFLICT",
      message: "题目草稿已被更新。请重新打开最新版本后再保存。",
      details: { currentRevision },
    });
  }
}
