import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const requireApi = createRequire(new URL("../../backend/api/package.json", import.meta.url));
const { PrismaClient } = requireApi("@yuzan/database");
const { PrismaPg } = requireApi("@prisma/adapter-pg");
const { Pool } = requireApi("pg");
const {
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
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

async function hashStream(stream) {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    hash.update(buffer);
  }
  return { bytes, sha256: hash.digest("hex") };
}

const bucket = required("S3_BUCKET");
const objectKey = "t109-native-acceptance/flower.webm";
const studentIdentifier = required("T109_STUDENT_IDENTIFIER");
const expectedMediaSha256 = "c6f8a348953395598a9a73b9bab1676436410797bce9f398f4be1531d6e76dda";
const pool = new Pool({ connectionString: required("DATABASE_URL"), max: 2 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const s3 = new S3Client({
  endpoint: required("S3_ENDPOINT"),
  region: process.env.S3_REGION || "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: required("S3_ACCESS_KEY_ID"),
    secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
  },
});

try {
  const school = await prisma.school.findUnique({ where: { code: "default-school" } });
  const student = await prisma.user.findUnique({ where: { loginIdentifier: studentIdentifier } });
  if (!school || !student) throw new Error("T109 school or student row is missing");
  const membership = await prisma.membership.findFirst({
    where: { schoolId: school.id, userId: student.id, role: "STUDENT", status: "ACTIVE" },
  });
  const enrollment = await prisma.enrollment.findFirst({
    where: { schoolId: school.id, userId: student.id, status: "ACTIVE" },
  });
  if (!membership || !enrollment) throw new Error("T109 active student membership or enrollment is missing");

  const course = await prisma.course.findFirst({
    where: { schoolId: school.id, stableKey: "t109-course-video-acceptance" },
    include: {
      versions: {
        where: { version: 1 },
        include: { units: { include: { lessons: { include: { activities: true } } } } },
      },
    },
  });
  if (!course || course.versions.length !== 1) throw new Error("T109 course version is missing");
  const courseVersion = course.versions[0];
  const activities = courseVersion.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities));
  const videoActivity = activities.find((item) => item.type === "VIDEO");
  const practiceActivity = activities.find((item) => item.title === "情境问候练习");
  if (!videoActivity || !practiceActivity) throw new Error("T109 video or practice activity is missing");

  const progress = await prisma.activityProgress.findMany({
    where: { enrollmentId: enrollment.id, activityId: { in: [videoActivity.id, practiceActivity.id] } },
    select: { activityId: true, position: true, completed: true, revision: true },
  });
  const videoProgress = progress.find((item) => item.activityId === videoActivity.id) || null;
  const practiceProgress = progress.find((item) => item.activityId === practiceActivity.id) || null;
  const videoSubmission = await prisma.submission.findFirst({
    where: { enrollmentId: enrollment.id, assignment: { courseVersionId: courseVersion.id } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, submittedAt: true },
  });

  const practiceDefinition = await prisma.practiceDefinition.findFirst({
    where: { schoolId: school.id, title: "T109 情境问候练习" },
    select: { id: true, status: true },
  });
  if (!practiceDefinition) throw new Error("T109 practice definition is missing");
  const sessions = await prisma.assessmentSession.findMany({
    where: { enrollmentId: enrollment.id, practiceDefinitionId: practiceDefinition.id },
    orderBy: { createdAt: "desc" },
    take: 1,
    include: {
      report: true,
      items: { include: { writtenAnswer: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  const session = sessions[0] || null;
  const report = session?.report || null;
  const reportSummary = report?.summary || {};
  const reportItems = session?.items || [];
  const reportItem = reportItems[0] || null;
  const allItemsUnansweredZeroScored = reportItems.length === 20 && reportItems.every((item) => (
    item.maxScore === 5
      && item.scoredScore === 0
      && item.recordingId === null
      && item.writtenAnswer === null
      && item.autoResult?.state === "AUTO_SCORED"
      && item.autoResult?.reasonCode === "UNANSWERED"
  ));
  const recordings = await prisma.recording.count({ where: { enrollmentId: enrollment.id } });
  const assignment = await prisma.assignment.findFirst({
    where: { schoolId: school.id, courseVersionId: courseVersion.id },
    select: { id: true, status: true },
  });

  await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
  const listed = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: objectKey }));
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
  const media = await hashStream(object.Body);

  const passed = courseVersion.status === "PUBLISHED"
    && assignment?.status === "OPEN"
    && Number.isFinite(videoProgress?.position) && videoProgress.position > 0
    && videoProgress.completed === true
    && session?.status === "COMPLETED"
    && Number(report?.overallScore) === 0
    && Number(reportSummary.totalItems) === 20
    && Number(reportSummary.answeredItems) === 0
    && Number(reportSummary.unansweredItems) === 20
    && allItemsUnansweredZeroScored
    && recordings === 0
    && Number(head.ContentLength) === media.bytes
    && media.sha256 === expectedMediaSha256
    && listed.Contents?.length === 1
    && listed.Contents[0].Key === objectKey
    && head.ContentType === "video/webm";

  const result = {
    taskId: "YZ-RD-T109",
    status: passed ? "PASS" : "FAIL",
    verification: "independent PostgreSQL and MinIO read after Browser/API run",
    database: "yz_rd_t109",
    accountAlias: "T109-STUDENT-01",
    schoolIdPrefix: prefix(school.id),
    studentIdPrefix: prefix(student.id),
    course: {
      courseIdPrefix: prefix(course.id),
      courseVersionIdPrefix: prefix(courseVersion.id),
      assignmentIdPrefix: prefix(assignment?.id),
      published: courseVersion.status === "PUBLISHED",
      assignmentOpen: assignment?.status === "OPEN",
    },
    postgres: {
      videoProgress: videoProgress && {
        activityIdPrefix: prefix(videoActivity.id),
        position: videoProgress.position,
        completed: videoProgress.completed,
        revision: videoProgress.revision,
      },
      practiceProgress: practiceProgress && {
        activityIdPrefix: prefix(practiceActivity.id),
        completed: practiceProgress.completed,
        revision: practiceProgress.revision,
      },
      courseSubmission: videoSubmission && {
        submissionIdPrefix: prefix(videoSubmission.id),
        status: videoSubmission.status,
        submitted: Boolean(videoSubmission.submittedAt),
      },
      unansweredSession: session && {
        sessionIdPrefix: prefix(session.id),
        status: session.status,
        courseActivityLinked: Boolean(session.courseActivityId),
        courseSubmissionLinked: Boolean(session.courseSubmissionId),
        reportIdPrefix: prefix(report?.id),
        overallScore: report?.overallScore,
        totalItems: reportSummary.totalItems,
        answeredItems: reportSummary.answeredItems,
        unansweredItems: reportSummary.unansweredItems,
        itemMaxScores: reportItems.map((item) => item.maxScore),
        itemScoredScores: reportItems.map((item) => item.scoredScore),
        allItemsAutoScoredAsUnansweredZero: allItemsUnansweredZeroScored,
        itemStatus: reportItem?.status,
        recordingIdCount: reportItems.filter((item) => item.recordingId != null).length,
        writtenAnswerCount: reportItems.filter((item) => item.writtenAnswer != null).length,
      },
      studentRecordingRows: recordings,
    },
    minio: {
      bucket,
      objectKey,
      contentLength: Number(head.ContentLength),
      contentType: head.ContentType,
      listedObjectCountForEvidencePrefix: listed.Contents?.length || 0,
      sha256: media.sha256,
      directGetBytes: media.bytes,
      expectedSha256Matched: media.sha256 === expectedMediaSha256,
    },
  };

  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!passed) process.exitCode = 2;
} finally {
  await prisma.$disconnect();
  await pool.end();
  s3.destroy();
}
