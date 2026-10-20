import { describe, expect, it, vi } from "vitest";
import { MembershipRole } from "../../src/common/security/membership-role.js";
import {
  MembershipStatus,
  type AuthContext,
} from "../../src/common/security/auth.types.js";
import type { QuestionBankDraftInputDto } from "../../src/modules/assessment/dto/question-bank-draft.dto.js";
import { QuestionBankAuthoringService } from "../../src/modules/assessment/question-bank-authoring.service.js";
import type { PrismaService } from "../../src/shared/database/prisma.service.js";

const schoolId = "11111111-1111-4111-8111-111111111111";
const teacherId = "22222222-2222-4222-8222-222222222222";
const itemId = "33333333-3333-4333-8333-333333333333";
const versionId = "44444444-4444-4444-8444-444444444444";
const now = new Date("2026-10-20T10:00:00.000Z");

function auth(
  roles: MembershipRole[] = [MembershipRole.TEACHER],
  activeSchoolId = schoolId,
  membershipStatus = MembershipStatus.ACTIVE,
  userId = teacherId,
): AuthContext {
  return {
    requestId: "question-bank-authoring-test",
    tenant: { schoolId: activeSchoolId },
    principal: { userId, roles, membershipStatus, source: "session" },
  };
}

function choiceInput(): QuestionBankDraftInputDto {
  return {
    title: "识别关键词",
    prompt: "请选出句子中的关键词。",
    itemType: "CHOICE",
    domain: "READ",
    difficulty: "EASY",
    gradeBand: "四年级",
    level: "水平一级",
    abilityCategory: "词语理解",
    maxScore: 5,
    options: [
      { key: "A", text: "答案甲" },
      { key: "B", text: "答案乙" },
    ],
    correctOption: "B",
  };
}

function textInput(): QuestionBankDraftInputDto {
  return {
    title: "补全词语",
    prompt: "请填写缺少的词语。",
    itemType: "TEXT",
    domain: "WRITE",
    difficulty: "MEDIUM",
    maxScore: 3,
    acceptedAnswers: ["春天", "春季"],
  };
}

function row(overrides: Record<string, unknown> = {}) {
  const { item: itemOverrides, ...rowOverrides } = overrides;
  return {
    id: versionId,
    itemId,
    version: 1,
    revision: 1,
    status: "DRAFT",
    publishedAt: null,
    deliverySpec: {
      instruction: "识别关键词",
      stimulus: { type: "TEXT", promptText: "请选出句子中的关键词。" },
      response: {
        type: "CHOICE",
        options: [
          { key: "A", text: "答案甲" },
          { key: "B", text: "答案乙" },
        ],
      },
    },
    scoringSpec: {
      strategy: "EXACT_CHOICE",
      maxScore: 5,
      referenceAnswer: "B",
    },
    createdAt: now,
    updatedAt: now,
    item: {
      id: itemId,
      domain: "READ",
      questionType: "TEACHER_AUTHORED_READ_CHOICE",
      level: "水平一级",
      abilityCategory: "词语理解",
      gradeBand: "四年级",
      difficulty: "EASY",
      itemType: "CHOICE",
      ...((itemOverrides as Record<string, unknown> | undefined) ?? {}),
    },
    ...rowOverrides,
  };
}

type VersionRow = ReturnType<typeof row>;
type CreateItemArgs = {
  data: {
    schoolId: string;
    stableKey: string;
    domain: string;
    questionType: string;
    level: string | null;
    abilityCategory: string | null;
    gradeBand: string | null;
    difficulty: string;
    itemType: string;
    versions: {
      create: {
        version: number;
        revision: number;
        authorUserId: string;
        deliverySpec: unknown;
        scoringSpec: unknown;
        status: string;
        publishedAt: null;
      };
    };
  };
  include: { versions: true };
};
type CreatedItem = VersionRow["item"] & { id: string; versions: VersionRow[] };
type UpdateVersionArgs = {
  where: {
    id: string;
    authorUserId: string;
    status: string;
    revision: number;
    item: { is: { schoolId: string } };
  };
  data: {
    deliverySpec: unknown;
    scoringSpec: unknown;
    revision: { increment: number };
  };
};
type UpdateItemArgs = {
  where: { id: string; schoolId: string };
  data: Record<string, unknown>;
};

function fakePrisma() {
  const tx = {
    questionBankItem: {
      create: vi.fn<(args: CreateItemArgs) => Promise<CreatedItem>>(),
      updateMany: vi.fn<(args: UpdateItemArgs) => Promise<{ count: number }>>(),
    },
    questionBankItemVersion: {
      findFirst: vi.fn(),
      updateMany:
        vi.fn<(args: UpdateVersionArgs) => Promise<{ count: number }>>(),
    },
  };
  const prisma = {
    questionBankItemVersion: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn((work: (transaction: typeof tx) => unknown) =>
      work(tx),
    ),
  };
  return { prisma, tx };
}

describe("QuestionBankAuthoringService", () => {
  it("creates a school- and author-owned DRAFT version in the existing QuestionBank tables", async () => {
    const { prisma, tx } = fakePrisma();
    const version = row();
    tx.questionBankItem.create.mockResolvedValue({
      id: itemId,
      domain: "READ",
      questionType: "TEACHER_AUTHORED_READ_CHOICE",
      level: "水平一级",
      abilityCategory: "词语理解",
      gradeBand: "四年级",
      difficulty: "EASY",
      itemType: "CHOICE",
      versions: [version],
    });
    const service = new QuestionBankAuthoringService(
      prisma as unknown as PrismaService,
    );

    const saved = await service.createDraft(auth(), schoolId, choiceInput());

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    const createData = tx.questionBankItem.create.mock.calls[0]?.[0]?.data;
    expect(createData.schoolId).toBe(schoolId);
    expect(createData.stableKey).toMatch(/^TEACHER-AUTHORED-/);
    expect(createData.versions.create).toMatchObject({
      version: 1,
      revision: 1,
      authorUserId: teacherId,
      status: "DRAFT",
      publishedAt: null,
    });
    expect(createData.versions.create.deliverySpec).toMatchObject({
      instruction: "识别关键词",
      stimulus: { promptText: "请选出句子中的关键词。" },
      response: { type: "CHOICE", options: [{ key: "A" }, { key: "B" }] },
    });
    expect(createData.versions.create.scoringSpec).toEqual({
      strategy: "EXACT_CHOICE",
      maxScore: 5,
      referenceAnswer: "B",
    });
    expect(saved).toMatchObject({
      questionVersionId: versionId,
      itemId,
      revision: 1,
      status: "DRAFT",
      reviewStatus: "NOT_SUBMITTED",
    });
    expect(JSON.stringify(saved)).not.toContain("authorUserId");
  });

  it("lists only versions authored by the active teacher in the requested school", async () => {
    const { prisma } = fakePrisma();
    prisma.questionBankItemVersion.findMany.mockResolvedValue([row()]);
    const service = new QuestionBankAuthoringService(
      prisma as unknown as PrismaService,
    );

    const result = await service.listDrafts(auth(), schoolId);

    expect(prisma.questionBankItemVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { authorUserId: teacherId, item: { is: { schoolId } } },
        take: 100,
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.status).toBe("DRAFT");
  });

  it("persists text answers as a teacher-only scoring spec", async () => {
    const { prisma, tx } = fakePrisma();
    const version = row({
      deliverySpec: {
        instruction: "补全词语",
        stimulus: { type: "TEXT", promptText: "请填写缺少的词语。" },
        response: { type: "TEXT" },
      },
      scoringSpec: {
        strategy: "ACCEPTED_TEXT",
        maxScore: 3,
        acceptedAnswers: ["春天", "春季"],
      },
      item: {
        itemType: "TEXT",
        questionType: "TEACHER_AUTHORED_WRITE_TEXT",
        domain: "WRITE",
      },
    });
    tx.questionBankItem.create.mockResolvedValue({
      ...version.item,
      id: itemId,
      versions: [version],
    });
    const service = new QuestionBankAuthoringService(
      prisma as unknown as PrismaService,
    );

    const saved = await service.createDraft(auth(), schoolId, textInput());

    expect(saved.acceptedAnswers).toEqual(["春天", "春季"]);
    expect(saved.options).toEqual([]);
    const createData = tx.questionBankItem.create.mock.calls[0]?.[0]?.data;
    expect(createData.versions.create.scoringSpec).toEqual({
      strategy: "ACCEPTED_TEXT",
      maxScore: 3,
      acceptedAnswers: ["春天", "春季"],
    });
  });

  it("reopens only the current author's version and hides another author's IDs as 404", async () => {
    const { prisma } = fakePrisma();
    const service = new QuestionBankAuthoringService(
      prisma as unknown as PrismaService,
    );
    prisma.questionBankItemVersion.findFirst.mockResolvedValue(null);

    await expect(
      service.getDraft(auth(), schoolId, versionId),
    ).rejects.toMatchObject({ status: 404 });
    expect(prisma.questionBankItemVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: versionId,
          authorUserId: teacherId,
          item: { is: { schoolId } },
        },
      }),
    );
  });

  it("does not imply a review decision for a version changed outside the DRAFT authoring flow", async () => {
    const { prisma } = fakePrisma();
    prisma.questionBankItemVersion.findFirst.mockResolvedValue(
      row({ status: "PUBLISHED", publishedAt: now }),
    );
    const service = new QuestionBankAuthoringService(
      prisma as unknown as PrismaService,
    );

    const result = await service.getDraft(auth(), schoolId, versionId);

    expect(result.status).toBe("PUBLISHED");
    expect(result.reviewStatus).toBe("NOT_TRACKED");
  });

  it("returns 403 for a different school and for a student, and 401 for an inactive membership", async () => {
    const { prisma } = fakePrisma();
    const service = new QuestionBankAuthoringService(
      prisma as unknown as PrismaService,
    );

    await expect(
      service.listDrafts(
        auth([MembershipRole.TEACHER], "99999999-9999-4999-8999-999999999999"),
        schoolId,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.listDrafts(auth([MembershipRole.STUDENT]), schoolId),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.listDrafts(
        auth([MembershipRole.TEACHER], schoolId, MembershipStatus.SUSPENDED),
        schoolId,
      ),
    ).rejects.toMatchObject({ status: 401 });
    expect(prisma.questionBankItemVersion.findMany).not.toHaveBeenCalled();
  });

  it("updates a draft atomically and increments the optimistic revision", async () => {
    const { prisma, tx } = fakePrisma();
    const before = row();
    const after = row({
      revision: 2,
      updatedAt: new Date("2026-10-20T10:05:00.000Z"),
    });
    tx.questionBankItemVersion.findFirst
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after);
    tx.questionBankItemVersion.updateMany.mockResolvedValue({ count: 1 });
    tx.questionBankItem.updateMany.mockResolvedValue({ count: 1 });
    const service = new QuestionBankAuthoringService(
      prisma as unknown as PrismaService,
    );

    const saved = await service.updateDraft(auth(), schoolId, versionId, {
      ...choiceInput(),
      title: "更新后的标题",
      expectedRevision: 1,
    });

    const versionUpdate =
      tx.questionBankItemVersion.updateMany.mock.calls[0]?.[0];
    expect(versionUpdate?.where).toEqual({
      id: versionId,
      authorUserId: teacherId,
      status: "DRAFT",
      revision: 1,
      item: { is: { schoolId } },
    });
    expect(versionUpdate?.data.revision).toEqual({ increment: 1 });
    const itemUpdate = tx.questionBankItem.updateMany.mock.calls[0]?.[0];
    expect(itemUpdate?.where).toEqual({ id: itemId, schoolId });
    expect(saved.revision).toBe(2);
  });

  it("returns 409 for stale revisions, races, and versions outside DRAFT", async () => {
    const { prisma, tx } = fakePrisma();
    const service = new QuestionBankAuthoringService(
      prisma as unknown as PrismaService,
    );
    const stale = row({ revision: 2 });
    tx.questionBankItemVersion.findFirst.mockResolvedValueOnce(stale);
    await expect(
      service.updateDraft(auth(), schoolId, versionId, {
        ...choiceInput(),
        expectedRevision: 1,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.questionBankItemVersion.updateMany).not.toHaveBeenCalled();

    tx.questionBankItemVersion.findFirst.mockResolvedValueOnce(row());
    tx.questionBankItemVersion.updateMany.mockResolvedValueOnce({ count: 0 });
    tx.questionBankItemVersion.findFirst.mockResolvedValueOnce(
      row({ revision: 2 }),
    );
    await expect(
      service.updateDraft(auth(), schoolId, versionId, {
        ...choiceInput(),
        expectedRevision: 1,
      }),
    ).rejects.toMatchObject({ status: 409 });

    tx.questionBankItemVersion.findFirst.mockResolvedValueOnce(
      row({ status: "PUBLISHED", publishedAt: now }),
    );
    await expect(
      service.updateDraft(auth(), schoolId, versionId, {
        ...choiceInput(),
        expectedRevision: 1,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("rejects invalid answer definitions before any write", async () => {
    const { prisma, tx } = fakePrisma();
    const service = new QuestionBankAuthoringService(
      prisma as unknown as PrismaService,
    );
    const invalid = { ...choiceInput(), correctOption: "D" };

    await expect(
      service.createDraft(auth(), schoolId, invalid),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.questionBankItem.create).not.toHaveBeenCalled();
  });
});
