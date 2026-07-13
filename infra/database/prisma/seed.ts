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

async function main() {
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
