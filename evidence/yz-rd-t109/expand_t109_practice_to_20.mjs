import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const requireApi = createRequire(new URL("../../backend/api/package.json", import.meta.url));
const { PrismaClient } = requireApi("@yuzan/database");
const { PrismaPg } = requireApi("@prisma/adapter-pg");
const { Pool } = requireApi("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const prefix = (value) => typeof value === "string" ? value.slice(0, 8) : null;
const now = new Date();
const questionCount = 20;

function questionSpec(number) {
  return {
    stableKey: `t109-synthetic-empty-choice-${String(number).padStart(3, "0")}`,
    deliverySpec: {
      stimulus: { type: "TEXT", promptText: `第 ${number} 题：在新的一天开始时，哪句话是友好的问候？` },
      response: {
        type: "CHOICE",
        options: [
          { key: "A", text: "再见。" },
          { key: "B", text: "早上好。" },
        ],
      },
    },
    scoringSpec: { strategy: "EXACT_CHOICE", maxScore: 5, referenceAnswer: "B" },
  };
}

try {
  const school = await prisma.school.findUnique({ where: { code: "default-school" } });
  const student = await prisma.user.findUnique({ where: { loginIdentifier: process.env.T109_STUDENT_IDENTIFIER }, select: { id: true } });
  const practice = school ? await prisma.practiceDefinition.findFirst({
    where: { schoolId: school.id, title: "T109 情境问候练习" },
  }) : null;
  if (!school || !student || !practice) throw new Error("T109-owned test school, student, or practice was not found");
  const enrollment = await prisma.enrollment.findFirst({
    where: { schoolId: school.id, userId: student.id, status: "ACTIVE" }, select: { id: true, classId: true },
  });
  if (!enrollment) throw new Error("T109 active enrollment is missing");

  const result = await prisma.$transaction(async (tx) => {
    const delivery = await tx.practiceDelivery.findFirst({
      where: {
        schoolId: school.id,
        status: "OPEN",
        mode: "ASSIGNMENT",
        classId: enrollment.classId,
        practiceVersion: { definitionId: practice.id },
      },
      include: { practiceVersion: { include: { sections: { include: { items: true } } } } },
    });
    if (!delivery) throw new Error("T109 active class delivery is missing");
    if (await tx.practiceVersion.findFirst({ where: { definitionId: practice.id, version: 2 }, select: { id: true } })) {
      throw new Error("T109 practice version 2 already exists; inspect its ownership before retry");
    }

    const specs = Array.from({ length: questionCount }, (_, index) => questionSpec(index + 1));
    const oldSessions = await tx.assessmentSession.findMany({
      where: { schoolId: school.id, enrollmentId: enrollment.id, practiceDefinitionId: practice.id, deliveryId: delivery.id },
      select: { id: true, status: true, courseActivityId: true, courseSubmissionId: true },
      orderBy: { createdAt: "asc" },
    });
    const recordingRows = await tx.recording.count({ where: { schoolId: school.id, enrollmentId: enrollment.id } });
    if (recordingRows !== 0) throw new Error("T109 test enrollment contains recording rows; refusing session cleanup");

    const version = await tx.practiceVersion.create({
      data: {
        definitionId: practice.id,
        version: 2,
        status: "PUBLISHED",
        contentHash: createHash("sha256").update(JSON.stringify(specs)).digest("hex"),
        publishedAt: now,
      },
    });
    const section = await tx.practiceSection.create({
      data: {
        versionId: version.id,
        title: "T109 情境判断（20道）",
        description: "20道 T109 自建无录音选择题，用于验证全部空答、零分与报告合同。",
        sortOrder: 1,
        estimatedMinutes: 5,
      },
    });

    const refs = [];
    for (let index = 0; index < specs.length; index += 1) {
      const spec = specs[index];
      const existingItem = await tx.questionBankItem.findFirst({ where: { schoolId: school.id, stableKey: spec.stableKey } });
      const item = existingItem || await tx.questionBankItem.create({
        data: {
          schoolId: school.id,
          stableKey: spec.stableKey,
          domain: "READ",
          questionType: "SENTENCE_COMPREHENSION",
          level: "T109-TEST-ONLY",
          abilityCategory: "句子理解",
          gradeBand: "七年级",
          difficulty: "入门",
          itemType: "SINGLE_CHOICE",
        },
      });
      const existingVersion = await tx.questionBankItemVersion.findFirst({ where: { itemId: item.id, version: 1 } });
      const questionVersion = existingVersion || await tx.questionBankItemVersion.create({
        data: {
          itemId: item.id,
          version: 1,
          deliverySpec: spec.deliverySpec,
          scoringSpec: spec.scoringSpec,
          sourceTrace: { taskId: "YZ-RD-T109", origin: "synthetic T109-only item", ordinal: index + 1 },
          status: "PUBLISHED",
          publishedAt: now,
        },
      });
      if (questionVersion.status !== "PUBLISHED" || questionVersion.scoringSpec?.maxScore !== 5) {
        throw new Error("T109 synthetic question version is not published with the valid 5-point maxScore rule");
      }
      const ref = await tx.practiceItemRef.create({
        data: {
          sectionId: section.id,
          questionId: item.id,
          questionVersionId: questionVersion.id,
          itemType: "SINGLE_CHOICE",
          sortOrder: index + 1,
          config: spec.deliverySpec,
        },
      });
      refs.push({ stableKey: spec.stableKey, questionVersionIdPrefix: prefix(questionVersion.id), refIdPrefix: prefix(ref.id) });
    }

    await tx.practiceDelivery.update({ where: { id: delivery.id }, data: { practiceVersionId: version.id, status: "OPEN" } });
    await tx.practiceDefinition.update({
      where: { id: practice.id },
      data: { summary: "T109 自建的20道无录音选择题，用于验证全部空答交卷计分。", estimatedMinutes: 5 },
    });
    const openStatuses = ["CREATED", "IN_PROGRESS", "SUBMITTED", "PROCESSING"];
    const deletableSessions = oldSessions.filter((session) => openStatuses.includes(session.status));
    const deleted = await tx.assessmentSession.deleteMany({
      where: {
        id: { in: deletableSessions.map((session) => session.id) },
        schoolId: school.id,
        enrollmentId: enrollment.id,
        practiceDefinitionId: practice.id,
        deliveryId: delivery.id,
        status: { in: openStatuses },
      },
    });
    return {
      practiceIdPrefix: prefix(practice.id),
      deliveryIdPrefix: prefix(delivery.id),
      oldVersionIdPrefix: prefix(delivery.practiceVersionId),
      newVersionIdPrefix: prefix(version.id),
      oldVersionItemCount: delivery.practiceVersion.sections.reduce((sum, current) => sum + current.items.length, 0),
      questionCount: refs.length,
      refs,
      removedOpenT109Sessions: deletableSessions.length,
      deletedSessionCount: deleted.count,
      recordingRows: recordingRows,
    };
  });

  process.stdout.write(`${JSON.stringify({ taskId: "YZ-RD-T109", status: "PASS", ...result })}\n`);
} finally {
  await prisma.$disconnect();
  await pool.end();
}
