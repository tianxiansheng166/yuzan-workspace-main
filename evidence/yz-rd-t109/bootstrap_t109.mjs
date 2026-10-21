import { createHash } from "node:crypto";
import { createReadStream, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";

const requireApi = createRequire(new URL("../../backend/api/package.json", import.meta.url));
const { PrismaClient } = requireApi("@yuzan/database");
const { PrismaPg } = requireApi("@prisma/adapter-pg");
const { Pool } = requireApi("pg");
const {
  HeadBucketCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} = requireApi("@aws-sdk/client-s3");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required T109 runtime variable: ${name}`);
  return value;
}

function prefix(value) {
  return typeof value === "string" ? value.slice(0, 8) : null;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

const bucket = required("S3_BUCKET");
const objectKey = "t109-native-acceptance/flower.webm";
const mediaPath = "/seed/flower.webm";
const mediaStats = statSync(mediaPath);
const mediaHash = sha256(readFileSync(mediaPath));
const studentIdentifier = required("T109_STUDENT_IDENTIFIER");
const now = new Date();
const start = new Date(now.getTime() - 60 * 60 * 1000);
const due = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

const s3 = new S3Client({
  endpoint: required("S3_ENDPOINT"),
  region: process.env.S3_REGION || "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: required("S3_ACCESS_KEY_ID"),
    secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
  },
});

const pool = new Pool({ connectionString: required("DATABASE_URL"), max: 2 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const school = await prisma.school.findUnique({ where: { code: "default-school" } });
  const student = await prisma.user.findUnique({ where: { loginIdentifier: studentIdentifier } });
  if (!school || !student) throw new Error("T109 registered student or isolated school is missing");

  const membership = await prisma.membership.findFirst({
    where: { schoolId: school.id, userId: student.id, role: "STUDENT", status: "ACTIVE" },
  });
  if (!membership) throw new Error("T109 student does not have an active student membership");

  const existingCourse = await prisma.course.findFirst({
    where: { schoolId: school.id, stableKey: "t109-course-video-acceptance" },
    select: { id: true },
  });
  if (existingCourse) throw new Error("T109 seed data already exists; inspect ownership before any retry");

  await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    Body: createReadStream(mediaPath),
    ContentLength: mediaStats.size,
    ContentType: "video/webm",
    Metadata: { license: "CC0-1.0", source: "mdn-interactive-examples" },
  }));
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
  const directObject = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
  const objectChunks = [];
  for await (const chunk of directObject.Body) objectChunks.push(Buffer.from(chunk));
  const directHash = sha256(Buffer.concat(objectChunks));
  if (Number(head.ContentLength) !== mediaStats.size || directHash !== mediaHash) {
    throw new Error("T109 MinIO object verification did not match the CC0 source file");
  }

  const seeded = await prisma.$transaction(async (tx) => {
    await tx.school.update({
      where: { id: school.id },
      data: { name: "T109 隔离验收学校" },
    });
    await tx.user.update({
      where: { id: student.id },
      data: { displayName: "T109 测试学生" },
    });

    const author = await tx.user.create({
      data: {
        loginIdentifier: "t109-content-author-nonlogin",
        displayName: "T109 测试课程作者",
        passwordHash: `disabled-t109-${createHash("sha256").update(`${now.toISOString()}:${student.id}`).digest("hex")}`,
        status: "DISABLED",
        preferredLocale: "zh-CN",
      },
    });

    const term = await tx.term.create({
      data: {
        schoolId: school.id,
        name: "T109 独立验收学期",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2027-01-01T00:00:00.000Z"),
        isActive: true,
      },
    });
    const classroom = await tx.class.create({
      data: {
        schoolId: school.id,
        termId: term.id,
        name: "T109 独立验收班",
        grade: "七年级",
      },
    });
    const enrollment = await tx.enrollment.create({
      data: {
        schoolId: school.id,
        classId: classroom.id,
        userId: student.id,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });

    const practice = await tx.practiceDefinition.create({
      data: {
        schoolId: school.id,
        visibility: "SCHOOL",
        title: "T109 情境问候练习",
        summary: "T109 自建的20道无录音选择题，用于验证全部空答交卷计分。",
        difficulty: "入门",
        estimatedMinutes: 5,
        gradeBand: "七年级",
        abilityCategories: ["句子理解"],
        cultureTags: ["T109-TEST-ONLY"],
        catalogType: "SPECIALIZED",
        requiresRecording: false,
        instantFeedback: false,
        status: "PUBLISHED",
      },
    });
    const questionSpecs = Array.from({ length: 20 }, (_, index) => {
      const ordinal = index + 1;
      return {
        ordinal,
        stableKey: `t109-synthetic-empty-choice-${String(ordinal).padStart(3, "0")}`,
        deliverySpec: {
          stimulus: { type: "TEXT", promptText: `第 ${ordinal} 题：在新的一天开始时，哪句话是友好的问候？` },
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
    });
    const practiceVersion = await tx.practiceVersion.create({
      data: {
        definitionId: practice.id,
        version: 1,
        status: "PUBLISHED",
        contentHash: sha256(Buffer.from(JSON.stringify(questionSpecs))),
        publishedAt: now,
      },
    });
    const section = await tx.practiceSection.create({
      data: {
        versionId: practiceVersion.id,
        title: "T109 情境判断（20道）",
        description: "20道测试题由 T109 单独编写，不含录音要求。",
        sortOrder: 1,
        estimatedMinutes: 5,
      },
    });
    const questionVersions = [];
    for (const spec of questionSpecs) {
      const question = await tx.questionBankItem.create({
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
      const questionVersion = await tx.questionBankItemVersion.create({
        data: {
          itemId: question.id,
          version: 1,
          deliverySpec: spec.deliverySpec,
          scoringSpec: spec.scoringSpec,
          sourceTrace: { taskId: "YZ-RD-T109", origin: "synthetic T109-only test item", ordinal: spec.ordinal },
          status: "PUBLISHED",
          publishedAt: now,
        },
      });
      questionVersions.push(questionVersion);
      await tx.practiceItemRef.create({
        data: {
          sectionId: section.id,
          questionId: question.id,
          questionVersionId: questionVersion.id,
          itemType: "SINGLE_CHOICE",
          sortOrder: spec.ordinal,
          config: spec.deliverySpec,
        },
      });
    }
    await tx.practiceDelivery.create({
      data: {
        practiceVersionId: practiceVersion.id,
        schoolId: school.id,
        classId: classroom.id,
        mode: "ASSIGNMENT",
        deadline: due,
        reRecordPolicy: { maxReRecord: 0 },
        mobilePolicy: { enabled: true },
        status: "OPEN",
      },
    });

    const course = await tx.course.create({
      data: {
        schoolId: school.id,
        authorUserId: author.id,
        stableKey: "t109-course-video-acceptance",
        title: "T109 真实课程视频验收",
      },
    });
    const courseVersion = await tx.courseVersion.create({
      data: {
        schoolId: school.id,
        courseId: course.id,
        version: 1,
        status: "PUBLISHED",
        title: "T109 真实课程视频验收",
        description: "独立验收数据；包含一段已授权 CC0 视频和一项真实练习入口。",
        gradeBand: "七年级",
        objectives: ["通过真实资源服务播放课程视频", "保存并恢复服务器学习进度"],
        capabilityTheme: "日常语言交流",
        difficulty: "入门",
        estimatedMinutes: 5,
        taskGroups: ["日常交流"],
        culturalElements: [],
        publishedAt: now,
        approvedAt: now,
      },
    });
    const unit = await tx.unit.create({
      data: { courseVersionId: courseVersion.id, title: "T109 视频与练习", sortOrder: 1 },
    });
    const lesson = await tx.lesson.create({
      data: { unitId: unit.id, title: "公开授权视频学习", sortOrder: 1 },
    });
    const videoActivity = await tx.learningActivity.create({
      data: {
        lessonId: lesson.id,
        type: "VIDEO",
        title: "观察花朵生长短片",
        instruction: { text: "播放视频并观察画面变化。" },
        sortOrder: 1,
        required: true,
        completionRule: { kind: "VIDEO_ENDED" },
        content: { description: "通过 T109 MinIO 资源播放公开授权的短片。" },
      },
    });
    const practiceActivity = await tx.learningActivity.create({
      data: {
        lessonId: lesson.id,
        type: "TEXT",
        title: "情境问候练习",
        instruction: { text: "打开本课练习并按页面指引完成。" },
        sortOrder: 2,
        required: true,
        completionRule: { kind: "PRACTICE_SUBMITTED" },
        content: { description: "练习由课程活动关联到 T109 已发布练习。" },
      },
    });
    await tx.courseActivityPractice.create({
      data: {
        schoolId: school.id,
        activityId: practiceActivity.id,
        practiceDefinitionId: practice.id,
        required: true,
      },
    });
    const resource = await tx.resource.create({
      data: {
        schoolId: school.id,
        kind: "VIDEO",
        objectKey,
        originalName: "flower.webm",
        mediaType: "video/webm",
        byteSize: BigInt(mediaStats.size),
        checksumSha256: mediaHash,
        rightsStatus: "APPROVED",
        rightsNote: "MDN interactive-examples flower.webm; CC0-1.0; source recorded in evidence/yz-rd-t109/media-license.json.",
      },
    });
    await tx.activityResource.create({
      data: {
        activityId: videoActivity.id,
        resourceId: resource.id,
        purpose: "PRIMARY_VIDEO",
        meta: { label: "公开视频素材（CC0-1.0）" },
      },
    });
    const assignment = await tx.assignment.create({
      data: {
        schoolId: school.id,
        courseVersionId: courseVersion.id,
        createdByUserId: author.id,
        title: "T109 真实课程视频验收",
        status: "OPEN",
        startsAt: start,
        dueAt: due,
        source: "TEACHER_ASSIGNED",
      },
    });
    await tx.assignmentTarget.create({
      data: {
        schoolId: school.id,
        assignmentId: assignment.id,
        targetType: "CLASS",
        classId: classroom.id,
      },
    });

    const recommendationCourse = await tx.course.create({
      data: {
        schoolId: school.id,
        authorUserId: author.id,
        stableKey: "t109-course-recommendation",
        title: "T109 推荐课程",
      },
    });
    const recommendationVersion = await tx.courseVersion.create({
      data: {
        schoolId: school.id,
        courseId: recommendationCourse.id,
        version: 1,
        status: "PUBLISHED",
        title: "T109 推荐课程",
        description: "同校、同主题、真实发布记录的推荐课程。",
        gradeBand: "七年级",
        objectives: ["查看真实课程推荐的动态导航"],
        capabilityTheme: "日常语言交流",
        difficulty: "入门",
        estimatedMinutes: 3,
        taskGroups: ["日常交流"],
        culturalElements: [],
        publishedAt: now,
        approvedAt: now,
      },
    });
    const recommendationUnit = await tx.unit.create({
      data: { courseVersionId: recommendationVersion.id, title: "推荐课程单元", sortOrder: 1 },
    });
    const recommendationLesson = await tx.lesson.create({
      data: { unitId: recommendationUnit.id, title: "课程介绍", sortOrder: 1 },
    });
    await tx.learningActivity.create({
      data: {
        lessonId: recommendationLesson.id,
        type: "TEXT",
        title: "查看课程介绍",
        instruction: { text: "阅读课程介绍。" },
        sortOrder: 1,
        required: true,
        content: { description: "T109 独立创建的推荐课程活动。" },
      },
    });
    const recommendationAssignment = await tx.assignment.create({
      data: {
        schoolId: school.id,
        courseVersionId: recommendationVersion.id,
        createdByUserId: author.id,
        title: "T109 推荐课程",
        status: "OPEN",
        startsAt: start,
        dueAt: due,
        source: "RECOMMENDED",
      },
    });
    await tx.assignmentTarget.create({
      data: {
        schoolId: school.id,
        assignmentId: recommendationAssignment.id,
        targetType: "CLASS",
        classId: classroom.id,
      },
    });

    return {
      schoolId: school.id,
      studentId: student.id,
      classId: classroom.id,
      enrollmentId: enrollment.id,
      assignmentId: assignment.id,
      recommendationAssignmentId: recommendationAssignment.id,
      videoActivityId: videoActivity.id,
      practiceActivityId: practiceActivity.id,
      practiceDefinitionId: practice.id,
      questionVersionId: questionVersions[0].id,
      questionVersionCount: questionVersions.length,
      resourceId: resource.id,
    };
  });

  process.stdout.write(`${JSON.stringify({
    taskId: "YZ-RD-T109",
    database: "yz_rd_t109",
    bucket,
    recordCounts: {
      schools: 1,
      students: 1,
      disabledContentAuthors: 1,
      activeStudentEnrollments: 1,
      courses: 2,
      openAssignments: 2,
      licensedVideoResources: 1,
      practices: 1,
      syntheticQuestionVersions: 20,
      recordings: 0,
    },
    ids: Object.fromEntries(Object.entries(seeded).map(([key, value]) => [key, prefix(value)])),
    media: {
      source: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm",
      license: "CC0-1.0",
      objectKey,
      bytes: Number(head.ContentLength),
      sha256: directHash,
      independentMinioRead: directHash === mediaHash,
    },
  })}\n`);
} finally {
  await prisma.$disconnect();
  await pool.end();
  s3.destroy();
}
