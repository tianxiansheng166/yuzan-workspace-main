import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const requireFromApi = createRequire(new URL("../../../backend/api/package.json", import.meta.url));
const { PrismaClient } = requireFromApi("@yuzan/database");
const { Pool } = requireFromApi("pg");
const { PrismaPg } = requireFromApi("@prisma/adapter-pg");
const { ScryptPasswordVerifier } = requireFromApi("./dist/modules/identity/adapters/scrypt-password-verifier.js");

const databaseUrl = process.env.DATABASE_URL;
const password = process.env.E2E_TEST_PASSWORD;
const manifestPath = process.env.YZ_T065_FIXTURE_MANIFEST;
if (!databaseUrl || !password || !manifestPath) throw new Error("T065 fixture requires its private database and manifest environment");

const parsed = new URL(databaseUrl);
if (parsed.hostname !== "127.0.0.1" || parsed.port !== "55765" || parsed.pathname !== "/yuzan_t065_native" || parsed.username !== "yz_t065") {
  throw new Error("T065 fixture refused a database outside the task-owned local database identity");
}

const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const verifier = new ScryptPasswordVerifier();
const suffix = randomUUID().slice(0, 8);
const TEST_ONLY = "TEST_FIXTURE_ONLY";

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const CLASS_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const TEACHER_ID = "33333333-3333-4333-8333-333333333333";
const STUDENT_ID = "22222222-2222-4222-8222-222222222222";

async function createQuestion(index, publishedAt) {
  const question = await prisma.questionBankItem.create({
    data: {
      schoolId: SCHOOL_ID,
      stableKey: `${TEST_ONLY}-T065-${suffix}-WRITTEN-${index}`,
      domain: "WRITE",
      questionType: "SENTENCE_COMPLETION",
      level: TEST_ONLY,
      abilityCategory: `${TEST_ONLY} T065 synthetic written review`,
      gradeBand: TEST_ONLY,
      difficulty: TEST_ONLY,
      itemType: "SHORT_ANSWER",
      versions: {
        create: {
          version: 1,
          status: "PUBLISHED",
          publishedAt,
          deliverySpec: {
            stimulus: { type: "TEXT", promptText: `${TEST_ONLY} T065 synthetic written response item ${index}.` },
            response: { type: "TEXT", placeholder: `${TEST_ONLY} T065 answer` },
          },
          scoringSpec: {
            strategy: "RUBRIC_TEXT",
            maxScore: 4,
            rubric: [`${TEST_ONLY} T065 synthetic criterion ${index}`],
          },
        },
      },
    },
    include: { versions: true },
  });
  const version = question.versions[0];
  if (!version || version.status !== "PUBLISHED" || !version.publishedAt) throw new Error("T065 synthetic QuestionBankItemVersion was not published");
  return { itemId: question.id, questionVersionId: version.id };
}

async function createUser({ id, loginIdentifier, displayName }) {
  const user = await prisma.user.create({
    data: {
      id,
      loginIdentifier,
      displayName,
      passwordHash: await verifier.hash(password),
      status: "ACTIVE",
      preferredLocale: "zh-CN",
    },
  });
  return { id: user.id, loginIdentifier, displayName };
}

async function main() {
  const [database] = await prisma.$queryRaw`SELECT current_database() AS name, current_user AS role`;
  if (database?.name !== "yuzan_t065_native" || database?.role !== "yz_t065") throw new Error("T065 fixture refused an unexpected PostgreSQL identity");

  const existingSchools = await prisma.school.findMany({ select: { id: true, code: true } });
  const existingUsers = await prisma.user.findMany({ select: { loginIdentifier: true } });
  const existingPractices = await prisma.practiceDefinition.findMany({ select: { title: true } });
  const existingItems = await prisma.questionBankItem.findMany({ select: { stableKey: true } });
  if (existingSchools.some((row) => row.id !== SCHOOL_ID && !row.code.startsWith("TEST-T065-FOREIGN-"))) throw new Error("T065 fixture refused to clean a non-task school row");
  if (existingUsers.some((row) => !row.loginIdentifier.startsWith("t065."))) throw new Error("T065 fixture refused to clean a non-task identity");
  if (existingPractices.some((row) => !row.title.startsWith(`${TEST_ONLY} T065 `))) throw new Error("T065 fixture refused to clean non-task practice content");
  if (existingItems.some((row) => !row.stableKey.startsWith(`${TEST_ONLY}-T065-`))) throw new Error("T065 fixture refused to clean non-task question bank content");
  await prisma.$transaction(async (tx) => {
    await tx.assessmentSession.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.practiceDelivery.deleteMany({ where: { schoolId: SCHOOL_ID } });
    await tx.practiceDefinition.deleteMany({ where: { title: { startsWith: `${TEST_ONLY} T065 ` } } });
    await tx.questionBankItem.deleteMany({ where: { stableKey: { startsWith: `${TEST_ONLY}-T065-` } } });
    await tx.school.deleteMany({ where: { id: SCHOOL_ID } });
    await tx.school.deleteMany({ where: { code: { startsWith: "TEST-T065-FOREIGN-" } } });
    await tx.user.deleteMany({ where: { loginIdentifier: { startsWith: "t065." } } });
  }, { maxWait: 10_000, timeout: 60_000 });

  const now = new Date();
  await prisma.school.create({ data: { id: SCHOOL_ID, code: `TEST-T065-${suffix}`, name: `${TEST_ONLY} T065 isolated school`, timezone: "Asia/Shanghai" } });
  const term = await prisma.term.create({
    data: { schoolId: SCHOOL_ID, name: `${TEST_ONLY} T065 term ${suffix}`, startsAt: new Date("2026-01-01T00:00:00.000Z"), endsAt: new Date("2036-12-31T00:00:00.000Z"), isActive: true },
  });
  const primaryClass = await prisma.class.create({
    data: { id: CLASS_ID, schoolId: SCHOOL_ID, termId: term.id, name: `${TEST_ONLY} T065 review class ${suffix}`, grade: TEST_ONLY },
  });
  const otherClass = await prisma.class.create({
    data: { schoolId: SCHOOL_ID, termId: term.id, name: `${TEST_ONLY} T065 other class ${suffix}`, grade: TEST_ONLY },
  });

  const teacher = await createUser({ id: TEACHER_ID, loginIdentifier: `t065.teacher.${suffix}@test.invalid`, displayName: `${TEST_ONLY} T065 review teacher ${suffix}` });
  const student = await createUser({ id: STUDENT_ID, loginIdentifier: `t065.student.${suffix}@test.invalid`, displayName: `${TEST_ONLY} T065 review student ${suffix}` });
  const otherStudent = await createUser({ loginIdentifier: `t065.other-student.${suffix}@test.invalid`, displayName: `${TEST_ONLY} T065 other student ${suffix}` });
  const otherClassTeacher = await createUser({ loginIdentifier: `t065.other-class-teacher.${suffix}@test.invalid`, displayName: `${TEST_ONLY} T065 other class teacher ${suffix}` });

  const foreignSchool = await prisma.school.create({
    data: { code: `TEST-T065-FOREIGN-${suffix}`, name: `${TEST_ONLY} T065 foreign school`, timezone: "Asia/Shanghai" },
  });
  const foreignTerm = await prisma.term.create({
    data: { schoolId: foreignSchool.id, name: `${TEST_ONLY} T065 foreign term ${suffix}`, startsAt: new Date("2026-01-01T00:00:00.000Z"), endsAt: new Date("2036-12-31T00:00:00.000Z"), isActive: true },
  });
  const foreignClass = await prisma.class.create({
    data: { schoolId: foreignSchool.id, termId: foreignTerm.id, name: `${TEST_ONLY} T065 foreign class ${suffix}`, grade: TEST_ONLY },
  });
  const foreignTeacher = await createUser({ loginIdentifier: `t065.foreign-teacher.${suffix}@test.invalid`, displayName: `${TEST_ONLY} T065 foreign teacher ${suffix}` });

  await prisma.membership.createMany({
    data: [
      { schoolId: SCHOOL_ID, userId: teacher.id, role: "TEACHER" },
      { schoolId: SCHOOL_ID, userId: student.id, role: "STUDENT" },
      { schoolId: SCHOOL_ID, userId: otherStudent.id, role: "STUDENT" },
      { schoolId: SCHOOL_ID, userId: otherClassTeacher.id, role: "TEACHER" },
      { schoolId: foreignSchool.id, userId: foreignTeacher.id, role: "TEACHER" },
    ],
  });
  await prisma.enrollment.createMany({
    data: [
      { schoolId: SCHOOL_ID, classId: primaryClass.id, userId: teacher.id, role: "TEACHER" },
      { schoolId: SCHOOL_ID, classId: primaryClass.id, userId: student.id, role: "STUDENT" },
      { schoolId: SCHOOL_ID, classId: primaryClass.id, userId: otherStudent.id, role: "STUDENT" },
      { schoolId: SCHOOL_ID, classId: otherClass.id, userId: otherClassTeacher.id, role: "TEACHER" },
      { schoolId: foreignSchool.id, classId: foreignClass.id, userId: foreignTeacher.id, role: "TEACHER" },
    ],
  });

  const publishedAt = now;
  const questions = [];
  for (let index = 1; index <= 20; index += 1) questions.push(await createQuestion(index, publishedAt));
  const definition = await prisma.practiceDefinition.create({
    data: {
      schoolId: SCHOOL_ID,
      visibility: "SCHOOL",
      title: `${TEST_ONLY} T065 speaking review fixture ${suffix}`,
      summary: `${TEST_ONLY}: synthetic API and review workflow fixture; not formal educational content, Tibetan material, or a classroom publication.`,
      difficulty: TEST_ONLY,
      estimatedMinutes: 1,
      gradeBand: TEST_ONLY,
      abilityCategories: [TEST_ONLY],
      cultureTags: [TEST_ONLY, "YZ-RD-T065"],
      catalogType: "SPECIALIZED",
      requiresRecording: false,
      instantFeedback: false,
      status: "PUBLISHED",
      versions: {
        create: {
          version: 1,
          status: "PUBLISHED",
          contentHash: `TEST_FIXTURE_ONLY-T065-${suffix}`,
          publishedAt,
          sections: {
            create: {
              title: `${TEST_ONLY} T065 synthetic section`,
              description: `${TEST_ONLY} isolated technical verification only.`,
              sortOrder: 1,
              estimatedMinutes: 1,
              items: {
                create: questions.map((question, index) => ({
                  itemType: "SHORT_ANSWER",
                  sortOrder: index + 1,
                  config: { fixturePolicy: TEST_ONLY, taskId: "YZ-RD-T065" },
                  questionVersionId: question.questionVersionId,
                })),
              },
            },
          },
        },
      },
    },
    include: { versions: { include: { sections: { include: { items: true } } } } },
  });
  const practiceVersion = definition.versions[0];
  const section = practiceVersion?.sections[0];
  if (!practiceVersion || !section) throw new Error("T065 test-only practice version was not created");
  const refs = section.items;
  if (refs.length !== questions.length || refs.length !== 20 || refs.some((ref, index) => ref.questionVersionId !== questions[index]?.questionVersionId)) {
    throw new Error("T065 PracticeItemRef linkage does not match its published QuestionBankItemVersion");
  }
  const delivery = await prisma.practiceDelivery.create({
    data: {
      practiceVersionId: practiceVersion.id,
      schoolId: SCHOOL_ID,
      classId: CLASS_ID,
      mode: "SELF_PRACTICE",
      status: "OPEN",
      reRecordPolicy: { maxAttempts: 1, fixturePolicy: TEST_ONLY },
      mobilePolicy: { allowed: true, fixturePolicy: TEST_ONLY },
    },
  });

  const manifest = {
    task: "YZ-RD-T065",
    fixturePolicy: TEST_ONLY,
    authoringPath: "direct Prisma fixture construction inside the task-owned isolated database; no Question Bank author/publish API exists",
    actualEducationContent: false,
    actualTibetanResource: false,
    classroomPublication: false,
    database: "yuzan_t065_native@127.0.0.1:55765",
    schoolId: SCHOOL_ID,
    classId: CLASS_ID,
    otherClassId: otherClass.id,
    foreignSchoolId: foreignSchool.id,
    foreignClassId: foreignClass.id,
    practiceDefinitionId: definition.id,
    practiceVersionId: practiceVersion.id,
    practiceDeliveryId: delivery.id,
    questionVersions: questions,
    practiceItemRefs: refs.map((ref) => ({ id: ref.id, questionVersionId: ref.questionVersionId, sortOrder: ref.sortOrder })),
    identities: {
      teacher: { id: teacher.id, loginIdentifier: teacher.loginIdentifier, displayName: teacher.displayName },
      student: { id: student.id, loginIdentifier: student.loginIdentifier, displayName: student.displayName },
      otherStudent: { id: otherStudent.id, loginIdentifier: otherStudent.loginIdentifier, displayName: otherStudent.displayName },
      otherClassTeacher: { id: otherClassTeacher.id, loginIdentifier: otherClassTeacher.loginIdentifier, displayName: otherClassTeacher.displayName },
      foreignTeacher: { id: foreignTeacher.id, loginIdentifier: foreignTeacher.loginIdentifier, displayName: foreignTeacher.displayName },
    },
  };
  await mkdir(dirname(manifestPath), { recursive: true, mode: 0o700 });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ task: manifest.task, fixturePolicy: TEST_ONLY, practiceDefinitionId: definition.id, practiceVersionId: practiceVersion.id, practiceDeliveryId: delivery.id, questionVersions: questions, practiceItemRefs: manifest.practiceItemRefs, database: manifest.database })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error?.name || "T065_FIXTURE_FAILED"}\n`);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
