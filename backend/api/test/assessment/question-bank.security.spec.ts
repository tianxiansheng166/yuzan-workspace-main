import { describe, expect, it, vi } from "vitest";
import { PracticeService } from "../../src/modules/assessment/practice.service.js";
import { MembershipRole } from "../../src/common/security/membership-role.js";
import { MembershipStatus, type AuthContext } from "../../src/common/security/auth.types.js";

const schoolId = "11111111-1111-4111-8111-111111111111";
const studentId = "22222222-2222-4222-8222-222222222222";
const definitionId = "f1111111-1111-4111-8111-111111111111";
const attemptId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const questionVersionId = "75555555-5555-4555-8555-555555555555";
const stableKey = "TEST-QB-CHOICE-001";
const enrollment = { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", classId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" };

const auth: AuthContext = {
  requestId: "question-bank-security-test",
  tenant: { schoolId },
  principal: { userId: studentId, roles: [MembershipRole.STUDENT], membershipStatus: MembershipStatus.ACTIVE, source: "session" },
};

const deliverySpec = {
  instruction: "请选择正确答案",
  stimulus: { type: "TEXT", promptText: "请选择正确答案" },
  response: {
    type: "CHOICE",
    options: ["A", "B", "C", "D"],
  },
};

const scoringSpec = {
  strategy: "EXACT_CHOICE",
  maxScore: 3,
  correctAnswer: "B",
  secretMarker: "SCORING_SECRET_MUST_NOT_LEAK_42",
};

function fakePrisma(overrides: Record<string, unknown> = {}) {
  const assessmentSession = {
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: attemptId, status: "CREATED" }),
  };
  const assessmentItem = {
    createMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const tx = {
    practiceDelivery: {
      findFirst: vi.fn().mockResolvedValue({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        practiceVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        practiceVersion: {
          sections: [{
            sortOrder: 1,
            title: "题库安全测试",
            items: [{
              questionVersionId,
              itemType: "CHOICE",
              sortOrder: 1,
              config: { legacyFallback: true },
              questionVersion: { id: questionVersionId, status: "PUBLISHED", deliverySpec, scoringSpec, item: { stableKey, schoolId } },
            }],
          }],
        },
      }),
    },
    assessmentSession,
    assessmentItem,
  };
  return {
    enrollment: { findFirst: vi.fn().mockResolvedValue(enrollment) },
    assessmentSession: { findFirst: vi.fn().mockResolvedValue({ id: attemptId, schoolId, enrollmentId: enrollment.id, practiceDefinitionId: definitionId }) },
    assessmentItem: {
      findMany: vi.fn().mockResolvedValue([{
        id: "item-001",
        itemType: "CHOICE",
        prompt: deliverySpec,
        itemConfig: deliverySpec,
        sectionTitle: "题库安全测试",
        sectionOrder: 1,
        sortOrder: 1,
        status: "PENDING",
        recordingId: null,
      }]),
    },
    $transaction: vi.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    ...overrides,
    __tx: tx,
  };
}

describe("Question Bank student delivery boundary", () => {
  it("snapshots deliverySpec and never returns scoringSpec or its marker", async () => {
    const prisma = fakePrisma();
    const service = new PracticeService(prisma as any);

    await service.createOrResume(auth, schoolId, definitionId);
    const snapshot = (prisma.__tx.assessmentItem.createMany.mock.calls[0][0] as { data: Array<Record<string, unknown>> }).data[0];
    expect(snapshot).toMatchObject({ questionVersionId, prompt: deliverySpec, itemConfig: deliverySpec, maxScore: 3 });
    expect(JSON.stringify(snapshot)).not.toContain("SCORING_SECRET_MUST_NOT_LEAK_42");

    const studentResponse = await service.getAttemptItems(auth, schoolId, attemptId);
    const serialized = JSON.stringify(studentResponse);
    expect(serialized).toContain("请选择正确答案");
    for (const option of ["A", "B", "C", "D"]) expect(serialized).toContain(option);
    expect(serialized).not.toContain("correctAnswer");
    expect(serialized).not.toContain("acceptedAnswers");
    expect(serialized).not.toContain("referenceAnswer");
    expect(serialized).not.toContain("scoringSpec");
    expect(serialized).not.toContain("SCORING_SECRET_MUST_NOT_LEAK_42");
  });

  it("fails closed when authored deliverySpec contains a protected scoring key", async () => {
    const prisma = fakePrisma();
    const service = new PracticeService(prisma as any);
    const unsafeVersion = {
      id: questionVersionId,
      status: "PUBLISHED",
      deliverySpec: { ...deliverySpec, correctAnswer: "B" },
      scoringSpec,
    };
    prisma.__tx.practiceDelivery.findFirst.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      practiceVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      practiceVersion: { sections: [{ sortOrder: 1, title: "题库安全测试", items: [{ questionVersionId, itemType: "CHOICE", sortOrder: 1, config: {}, questionVersion: unsafeVersion }] }] },
    });

    await expect(service.createOrResume(auth, schoolId, definitionId)).rejects.toThrow("受保护的评分字段");
    expect(prisma.__tx.assessmentItem.createMany).not.toHaveBeenCalled();
  });
});
