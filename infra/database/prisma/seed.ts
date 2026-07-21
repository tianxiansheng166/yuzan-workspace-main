import { promisify } from "node:util";
import { scrypt as scryptCallback } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../dist/generated/client/client.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for seed");

const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const scrypt = promisify(scryptCallback);

const ids = {
  school: "11111111-1111-4111-8111-111111111111",
  student: "22222222-2222-4222-8222-222222222222",
  teacher: "33333333-3333-4333-8333-333333333333",
  volunteer: "44444444-4444-4444-8444-444444444444",
  admin: "55555555-5555-4555-8555-555555555555",
  researcher: "66666666-6666-4666-8666-666666666666",
  training: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  moduleSafety: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  moduleBoundary: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  enrollment: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  volunteerProfile: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  term: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  class: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  studentEnrollment: "f1111111-1111-4111-8111-111111111111",
  teacherEnrollment: "f2222222-2222-4222-8222-222222222222",
  course: "f3333333-3333-4333-8333-333333333333",
  courseVersion: "f4444444-4444-4444-8444-444444444444",
  unit: "f5555555-5555-4555-8555-555555555555",
  lesson: "f6666666-6666-4666-8666-666666666666",
  activity: "f7777777-7777-4777-8777-777777777777",
  assignment: "f8888888-8888-4888-8888-888888888888",
  assignmentTarget: "f9999999-9999-4999-8999-999999999999",
  activityProgress: "fa111111-1111-4111-8111-111111111111",
  submission: "fa222222-2222-4222-8222-222222222222",
  report: "fa333333-3333-4333-8333-333333333333",
  practiceClassical: "70000000-0000-4000-8000-000000000001",
  practiceModern: "70000000-0000-4000-8000-000000000002",
  practiceRhythm: "70000000-0000-4000-8000-000000000003",
  versionClassical: "71000000-0000-4000-8000-000000000001",
  versionModern: "71000000-0000-4000-8000-000000000002",
  versionRhythm: "71000000-0000-4000-8000-000000000003",
  deliveryClassical: "72000000-0000-4000-8000-000000000001",
  deliveryModern: "72000000-0000-4000-8000-000000000002",
  deliveryRhythm: "72000000-0000-4000-8000-000000000003",
} as const;

async function passwordHash(password: string) {
  const salt = Buffer.from("yuzan-test-seed-2026", "utf8");
  const derived = (await scrypt(password, salt, 32, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  })) as Buffer;
  return `$scrypt$16384$8$1$${salt.toString("base64")}$${derived.toString("base64")}`;
}

type SeedPractice = {
  id: string; versionId: string; deliveryId: string; title: string; summary: string;
  difficulty: string; estimatedMinutes: number; mode: "ASSIGNMENT" | "SELF_PRACTICE";
  sections: Array<{ title: string; description: string; minutes: number; items: Array<{ type: string; config: Record<string, unknown> }> }>;
};

async function seedReusablePractices() {
  const environment = process.env.NODE_ENV ?? "development";
  if (environment !== "development" && environment !== "test") {
    throw new Error("Reusable practice bootstrap is restricted to development/test");
  }

  const practices: SeedPractice[] = [
    {
      id: ids.practiceClassical, versionId: ids.versionClassical, deliveryId: ids.deliveryClassical,
      title: "古诗文朗读与理解训练", summary: "在听读、跟读和理解表达中感受古诗文的节奏与意境。", difficulty: "七年级", estimatedMinutes: 22, mode: "ASSIGNMENT",
      sections: [
        { title: "听读感知", description: "先听范读，留意停顿和语气。", minutes: 4, items: [{ type: "LISTEN_ONLY", config: { instruction: "聆听《木兰诗》节选范读，记录两个停顿位置。", stimulus: "唧唧复唧唧，木兰当户织。", demoAudioUrl: "/student/growth/assets/practice-sample.wav" } }] },
        { title: "跟读练习", description: "跟随范读完成一句一句的练习。", minutes: 5, items: [{ type: "LISTEN_REPEAT", config: { instruction: "听完示范后，跟读下面的句子。", targetText: "万里赴戎机，关山度若飞。", demoAudioUrl: "/student/growth/assets/practice-sample.wav", maxScore: 20 } }] },
        { title: "独立朗读", description: "用清晰的语速朗读选段。", minutes: 5, items: [{ type: "READ_ALOUD", config: { instruction: "请独立朗读下面的句子，注意节奏。", targetText: "朔气传金柝，寒光照铁衣。", maxScore: 20 } }] },
        { title: "文意选择", description: "根据材料完成理解判断。", minutes: 4, items: [{ type: "SINGLE_CHOICE", config: { prompt: "“关山度若飞”主要表现了什么？", options: ["行军路途遥远而迅疾", "关山飞翔", "军营生活安逸", "木兰正在织布"], required: true, maxScore: 20 } }] },
        { title: "意境表达", description: "用自己的话说明诗句传递的感受。", minutes: 4, items: [{ type: "SHORT_ANSWER", config: { prompt: "用两三句话说说这段诗给你的画面感。", required: true, maxScore: 20 } }] },
      ],
    },
    {
      id: ids.practiceModern, versionId: ids.versionModern, deliveryId: ids.deliveryModern,
      title: "现代文朗读与信息提取", summary: "在真实短文中练习倾听、朗读和抓取关键信息。", difficulty: "七年级", estimatedMinutes: 15, mode: "SELF_PRACTICE",
      sections: [
        { title: "听材料", description: "先整体理解材料内容。", minutes: 3, items: [{ type: "LISTEN_ONLY", config: { instruction: "聆听关于高原春天的短文。", stimulus: "冰雪消融后，山坡上的草芽最先醒来。", demoAudioUrl: "/student/growth/assets/practice-sample.wav" } }] },
        { title: "朗读短文", description: "读出叙述的节奏。", minutes: 4, items: [{ type: "READ_ALOUD", config: { instruction: "请朗读材料句子。", targetText: "清晨的风穿过山谷，带来泥土和松针的清香。", maxScore: 25 } }] },
        { title: "信息提取", description: "选择材料中的明确信息。", minutes: 4, items: [{ type: "MULTIPLE_CHOICE", config: { prompt: "材料中提到了哪些景物？", options: ["山谷", "松针", "海浪", "泥土"], required: true, maxScore: 25 } }] },
        { title: "简要回答", description: "准确而完整地表达。", minutes: 4, items: [{ type: "SHORT_ANSWER", config: { prompt: "作者从哪些感觉写出了清晨的特点？", required: true, maxScore: 25 } }] },
      ],
    },
    {
      id: ids.practiceRhythm, versionId: ids.versionRhythm, deliveryId: ids.deliveryRhythm,
      title: "停顿与节奏专项训练", summary: "通过听辨、跟读、朗读和回听，找到更自然的表达节奏。", difficulty: "基础巩固", estimatedMinutes: 10, mode: "SELF_PRACTICE",
      sections: [
        { title: "听辨停顿", description: "辨认更自然的朗读停顿。", minutes: 2, items: [{ type: "SINGLE_CHOICE", config: { prompt: "哪一种停顿更自然？", options: ["春风 / 又绿江南岸", "春 / 风又绿江南岸"], required: true, maxScore: 25 } }] },
        { title: "跟读节奏", description: "模仿示范的轻重与停连。", minutes: 3, items: [{ type: "LISTEN_REPEAT", config: { instruction: "听完示范后跟读。", targetText: "春风又绿江南岸，明月何时照我还。", demoAudioUrl: "/student/growth/assets/practice-sample.wav", maxScore: 25 } }] },
        { title: "自主朗读", description: "将节奏用于完整句子。", minutes: 3, items: [{ type: "READ_ALOUD", config: { instruction: "请独立朗读。", targetText: "海日生残夜，江春入旧年。", maxScore: 25 } }] },
        { title: "回听反思", description: "回听后写下一个可改进点。", minutes: 2, items: [{ type: "LISTEN_RETELL", config: { prompt: "回听自己的朗读后，写下一个准备调整的停顿或语速问题。", required: true, maxScore: 25 } }] },
      ],
    },
  ];

  for (const practice of practices) {
    await prisma.practiceDefinition.upsert({
      where: { id: practice.id },
      // Bootstrap never edits an already-published definition/version. A new
      // version is the only valid route for content changes outside this seed.
      update: {},
      create: { id: practice.id, schoolId: ids.school, visibility: "SCHOOL", title: practice.title, summary: practice.summary, coverAsset: "/assessment/assets/mountain-world.webp", difficulty: practice.difficulty, estimatedMinutes: practice.estimatedMinutes, status: "PUBLISHED" },
    });
    const existingVersion = await prisma.practiceVersion.findUnique({ where: { id: practice.versionId }, select: { id: true } });
    if (!existingVersion) {
      await prisma.practiceVersion.create({ data: { id: practice.versionId, definitionId: practice.id, version: 1, status: "PUBLISHED", contentHash: `seed-${practice.id}-v1`, publishedAt: new Date("2026-07-21T00:00:00.000Z") } });
      for (const [sectionIndex, section] of practice.sections.entries()) {
        const created = await prisma.practiceSection.create({ data: { versionId: practice.versionId, title: section.title, description: section.description, sortOrder: sectionIndex + 1, estimatedMinutes: section.minutes } });
        await prisma.practiceItemRef.createMany({ data: section.items.map((item, itemIndex) => ({ sectionId: created.id, questionId: `73000000-0000-4000-8000-${String(sectionIndex * 10 + itemIndex + 1).padStart(12, "0")}`, itemType: item.type, sortOrder: itemIndex + 1, config: item.config })) });
      }
    }
    await prisma.practiceDelivery.upsert({
      where: { id: practice.deliveryId },
      update: { status: "OPEN", mode: practice.mode, practiceVersionId: practice.versionId, classId: ids.class, studentId: null },
      create: { id: practice.deliveryId, practiceVersionId: practice.versionId, schoolId: ids.school, classId: ids.class, mode: practice.mode, reRecordPolicy: { maxAttempts: 2, allowAfterUpload: true }, mobilePolicy: { allowed: true, minNetwork: "3g" }, status: "OPEN" },
    });
  }
}

async function main() {
  if (!["development", "test"].includes(process.env.NODE_ENV ?? "development")) {
    throw new Error("Seed is restricted to development/test");
  }
  const hash = await passwordHash("YuzanTest!2026");
  await prisma.school.upsert({
    where: { id: ids.school },
    update: { name: "语赞测试学校", isActive: true },
    create: {
      id: ids.school,
      code: "YZ-TEST-001",
      name: "语赞测试学校",
      regionCode: "TEST",
    },
  });

  const accounts = [
    [ids.student, "student.test", "测试学生", "STUDENT"],
    [ids.teacher, "teacher.test", "测试教师", "TEACHER"],
    [ids.volunteer, "volunteer.test", "测试志愿者", "VOLUNTEER"],
    [ids.admin, "admin.test", "测试管理员", "SCHOOL_ADMIN"],
    [ids.researcher, "researcher.test", "测试教研员", "RESEARCHER"],
  ] as const;

  for (const [id, loginIdentifier, displayName, role] of accounts) {
    await prisma.user.upsert({
      where: { id },
      update: {
        loginIdentifier,
        displayName,
        passwordHash: hash,
        status: "ACTIVE",
      },
      create: {
        id,
        loginIdentifier,
        displayName,
        passwordHash: hash,
        status: "ACTIVE",
      },
    });
    await prisma.membership.upsert({
      where: {
        schoolId_userId_role: { schoolId: ids.school, userId: id, role },
      },
      update: { status: "ACTIVE" },
      create: { schoolId: ids.school, userId: id, role, status: "ACTIVE" },
    });
  }

  await prisma.term.upsert({
    where: { id: ids.term },
    update: { isActive: true },
    create: {
      id: ids.term,
      schoolId: ids.school,
      name: "2026 测试学期",
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      endsAt: new Date("2026-12-31T23:59:59.000Z"),
      isActive: true,
    },
  });

  await prisma.class.upsert({
    where: { id: ids.class },
    update: { name: "七年级真实流程班", grade: "七年级" },
    create: {
      id: ids.class,
      schoolId: ids.school,
      termId: ids.term,
      name: "七年级真实流程班",
      grade: "七年级",
    },
  });

  for (const enrollment of [
    {
      id: ids.studentEnrollment,
      userId: ids.student,
      role: "STUDENT" as const,
    },
    {
      id: ids.teacherEnrollment,
      userId: ids.teacher,
      role: "TEACHER" as const,
    },
  ]) {
    await prisma.enrollment.upsert({
      where: { id: enrollment.id },
      update: { status: "ACTIVE" },
      create: {
        ...enrollment,
        schoolId: ids.school,
        classId: ids.class,
        status: "ACTIVE",
      },
    });
  }

  await prisma.course.upsert({
    where: { id: ids.course },
    update: { title: "真实学习流程课程" },
    create: {
      id: ids.course,
      schoolId: ids.school,
      authorUserId: ids.teacher,
      stableKey: "seed-real-learning-flow",
      title: "真实学习流程课程",
    },
  });

  await prisma.courseVersion.upsert({
    where: { id: ids.courseVersion },
    update: { status: "PUBLISHED", title: "真实学习流程课程" },
    create: {
      id: ids.courseVersion,
      schoolId: ids.school,
      courseId: ids.course,
      version: 1,
      status: "PUBLISHED",
      title: "真实学习流程课程",
      description: "用于四端真实点击旅程的虚构课程数据。",
      gradeBand: "七年级",
      publishedAt: new Date("2026-07-01T00:00:00.000Z"),
    },
  });

  await prisma.unit.upsert({
    where: { id: ids.unit },
    update: { title: "第一单元" },
    create: {
      id: ids.unit,
      courseVersionId: ids.courseVersion,
      title: "第一单元",
      sortOrder: 1,
    },
  });

  await prisma.lesson.upsert({
    where: { id: ids.lesson },
    update: { title: "连续学习旅程" },
    create: {
      id: ids.lesson,
      unitId: ids.unit,
      title: "连续学习旅程",
      sortOrder: 1,
    },
  });

  await prisma.learningActivity.upsert({
    where: { id: ids.activity },
    update: { title: "完成一次真实学习进度" },
    create: {
      id: ids.activity,
      lessonId: ids.lesson,
      type: "TEXT",
      title: "完成一次真实学习进度",
      instruction: { originalText: "阅读说明后，将完成状态保存到服务器。" },
      sortOrder: 1,
      required: true,
    },
  });

  await prisma.assignment.upsert({
    where: { id: ids.assignment },
    update: { status: "OPEN", revision: 1 },
    create: {
      id: ids.assignment,
      schoolId: ids.school,
      courseVersionId: ids.courseVersion,
      createdByUserId: ids.teacher,
      title: "真实学习与反馈任务",
      status: "OPEN",
      startsAt: new Date("2026-07-01T00:00:00.000Z"),
      dueAt: new Date("2026-12-31T23:59:59.000Z"),
      openedAt: new Date("2026-07-01T00:00:00.000Z"),
    },
  });

  await prisma.assignmentTarget.upsert({
    where: { id: ids.assignmentTarget },
    update: { enrollmentId: ids.studentEnrollment },
    create: {
      id: ids.assignmentTarget,
      schoolId: ids.school,
      assignmentId: ids.assignment,
      targetType: "STUDENT",
      enrollmentId: ids.studentEnrollment,
    },
  });

  await prisma.activityProgress.upsert({
    where: {
      activityId_enrollmentId: {
        activityId: ids.activity,
        enrollmentId: ids.studentEnrollment,
      },
    },
    update: {},
    create: {
      id: ids.activityProgress,
      schoolId: ids.school,
      activityId: ids.activity,
      enrollmentId: ids.studentEnrollment,
      position: 0,
      completed: false,
    },
  });

  await prisma.feedback.deleteMany({
    where: { submissionId: ids.submission },
  });
  await prisma.submission.upsert({
    where: { id: ids.submission },
    update: { status: "NEEDS_REVIEW" },
    create: {
      id: ids.submission,
      schoolId: ids.school,
      assignmentId: ids.assignment,
      enrollmentId: ids.studentEnrollment,
      attemptNo: 1,
      status: "NEEDS_REVIEW",
      idempotencyKey: "seed-review-submission",
      submittedAt: new Date("2026-07-10T00:00:00.000Z"),
    },
  });

  await prisma.report.upsert({
    where: { id: ids.report },
    update: { status: "READY", enrollmentId: ids.studentEnrollment },
    create: {
      id: ids.report,
      schoolId: ids.school,
      type: "STUDENT_GROWTH",
      status: "READY",
      periodStart: new Date("2026-07-01T00:00:00.000Z"),
      periodEnd: new Date("2026-07-31T23:59:59.000Z"),
      dataCompleteness: 0.8,
      providerDisclosure: "由本地测试数据库中的真实流程记录汇总。",
      generatedAt: new Date("2026-07-14T00:00:00.000Z"),
      generatedByUserId: ids.teacher,
      enrollmentId: ids.studentEnrollment,
      classId: ids.class,
      data: {
        completedActivities: 0,
        submissionCount: 1,
        note: "虚构测试身份，不包含真实学生数据。",
      },
    },
  });

  await prisma.volunteerProfile.upsert({
    where: { schoolId_userId: { schoolId: ids.school, userId: ids.volunteer } },
    update: { status: "ACTIVE", displayName: "测试志愿者" },
    create: {
      id: ids.volunteerProfile,
      schoolId: ids.school,
      userId: ids.volunteer,
      status: "ACTIVE",
      displayName: "测试志愿者",
      phone: "000-0000-0000",
      qualifications: ["TEST_TRAINING_ELIGIBLE"],
      qualifiedAt: new Date("2026-07-01T00:00:00.000Z"),
    },
  });

  await prisma.trainingProgram.upsert({
    where: { id: ids.training },
    update: { status: "PUBLISHED", title: "志愿服务安全与边界" },
    create: {
      id: ids.training,
      schoolId: ids.school,
      title: "志愿服务安全与边界",
      description: "用于验证真实培训进度持久化的虚构测试培训。",
      objectives: ["识别服务边界", "遵循最小披露"],
      status: "PUBLISHED",
    },
  });

  for (const module of [
    {
      id: ids.moduleSafety,
      title: "服务安全基础",
      sortOrder: 1,
      durationMinutes: 10,
    },
    {
      id: ids.moduleBoundary,
      title: "信息披露边界",
      sortOrder: 2,
      durationMinutes: 12,
    },
  ]) {
    await prisma.trainingModule.upsert({
      where: { id: module.id },
      update: {
        title: module.title,
        sortOrder: module.sortOrder,
        durationMinutes: module.durationMinutes,
      },
      create: {
        ...module,
        schoolId: ids.school,
        programId: ids.training,
        required: true,
      },
    });
  }

  await prisma.trainingEnrollment.upsert({
    where: {
      schoolId_programId_volunteerUserId: {
        schoolId: ids.school,
        programId: ids.training,
        volunteerUserId: ids.volunteer,
      },
    },
    update: { status: "ENROLLED" },
    create: {
      id: ids.enrollment,
      schoolId: ids.school,
      programId: ids.training,
      volunteerUserId: ids.volunteer,
      status: "ENROLLED",
    },
  });

  await seedReusablePractices();
}

try {
  await main();
  console.log(
    "Seeded fictional four-port identities, teaching loop, reports, and volunteer training data.",
  );
} finally {
  await prisma.$disconnect();
  await pool.end();
}
