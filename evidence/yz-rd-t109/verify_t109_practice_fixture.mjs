import { createRequire } from "node:module";

const requireApi = createRequire(new URL("../../backend/api/package.json", import.meta.url));
const { PrismaClient } = requireApi("@yuzan/database");
const { PrismaPg } = requireApi("@prisma/adapter-pg");
const { Pool } = requireApi("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const prefix = (value) => typeof value === "string" ? value.slice(0, 8) : null;

try {
  const school = await prisma.school.findUnique({ where: { code: "default-school" }, select: { id: true } });
  const student = await prisma.user.findUnique({ where: { loginIdentifier: process.env.T109_STUDENT_IDENTIFIER }, select: { id: true } });
  const enrollment = school && student ? await prisma.enrollment.findFirst({
    where: { schoolId: school.id, userId: student.id, status: "ACTIVE" },
    select: { classId: true },
  }) : null;
  const practice = school ? await prisma.practiceDefinition.findFirst({
    where: { schoolId: school.id, title: "T109 情境问候练习" },
    select: { id: true, status: true, requiresRecording: true, estimatedMinutes: true },
  }) : null;
  const delivery = school && enrollment && practice ? await prisma.practiceDelivery.findFirst({
    where: { schoolId: school.id, classId: enrollment.classId, mode: "ASSIGNMENT", status: "OPEN", practiceVersion: { definitionId: practice.id } },
    include: {
      practiceVersion: {
        include: {
          sections: {
            orderBy: { sortOrder: "asc" },
            include: {
              items: {
                orderBy: { sortOrder: "asc" },
                include: { questionVersion: { include: { item: { select: { id: true, schoolId: true, stableKey: true } } } } },
              },
            },
          },
        },
      },
    },
  }) : null;
  const refs = delivery?.practiceVersion.sections.flatMap((section) => section.items) || [];
  const valid = Boolean(school && student && enrollment && practice && delivery)
    && practice.status === "PUBLISHED"
    && practice.requiresRecording === false
    && delivery.practiceVersion.version === 2
    && refs.length === 20
    && refs.every((ref) => ref.itemType === "SINGLE_CHOICE"
      && ref.questionVersion?.status === "PUBLISHED"
      && ref.questionVersion?.item?.schoolId === school.id
      && ref.questionVersion?.scoringSpec?.strategy === "EXACT_CHOICE"
      && ref.questionVersion?.scoringSpec?.maxScore === 5);
  process.stdout.write(`${JSON.stringify({
    taskId: "YZ-RD-T109",
    status: valid ? "PASS" : "FAIL",
    practiceIdPrefix: prefix(practice?.id),
    deliveryIdPrefix: prefix(delivery?.id),
    practiceVersionIdPrefix: prefix(delivery?.practiceVersionId),
    practiceVersion: delivery?.practiceVersion.version,
    practiceStatus: practice?.status,
    requiresRecording: practice?.requiresRecording,
    publishedSyntheticQuestionCount: refs.length,
    itemTypes: [...new Set(refs.map((ref) => ref.itemType))],
    maxScores: [...new Set(refs.map((ref) => ref.questionVersion?.scoringSpec?.maxScore))],
    allQuestionItemsT109Owned: refs.every((ref) => ref.questionVersion?.item?.schoolId === school?.id),
    questionStableKeyPrefixes: refs.map((ref) => ref.questionVersion?.item?.stableKey?.slice(0, 24) ?? null),
  })}\n`);
  if (!valid) process.exitCode = 2;
} finally {
  await prisma.$disconnect();
  await pool.end();
}
