import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const requireApi = createRequire(new URL("../../backend/api/package.json", import.meta.url));
const { PrismaClient } = requireApi("@yuzan/database");
const { PrismaPg } = requireApi("@prisma/adapter-pg");
const { Pool } = requireApi("pg");
const { GetObjectCommand, HeadBucketCommand, HeadObjectCommand, S3Client } = requireApi("@aws-sdk/client-s3");

const target = process.argv[2];
const media = {
  mp4: {
    key: "t109-native-acceptance/flower.mp4",
    name: "flower.mp4",
    type: "video/mp4",
    bytes: 1128375,
    sha256: "0cd83d944a6ca7822b4a8306cecc60a36e859b041f6702c6a1ad9ead78924451",
    note: "MDN interactive-examples flower.mp4; CC0-1.0; codec-error diagnostic asset.",
  },
  webm: {
    key: "t109-native-acceptance/flower.webm",
    name: "flower.webm",
    type: "video/webm",
    bytes: 554058,
    sha256: "c6f8a348953395598a9a73b9bab1676436410797bce9f398f4be1531d6e76dda",
    note: "MDN interactive-examples flower.webm; CC0-1.0; VP8/Vorbis browser acceptance asset.",
  },
};
if (!media[target]) throw new Error("Target must be mp4 or webm");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing T109 environment setting: ${name}`);
  return value;
}

function prefix(value) {
  return typeof value === "string" ? value.slice(0, 8) : null;
}

async function digest(stream) {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of stream) {
    const data = Buffer.from(chunk);
    hash.update(data);
    bytes += data.length;
  }
  return { bytes, sha256: hash.digest("hex") };
}

const bucket = required("S3_BUCKET");
if (bucket !== "yz-rd-t109-media") throw new Error("Refusing to update a non-T109 bucket");
const pool = new Pool({ connectionString: required("DATABASE_URL"), max: 1 });
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
  const expected = media[target];
  await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: expected.key }));
  const actual = await digest((await s3.send(new GetObjectCommand({ Bucket: bucket, Key: expected.key }))).Body);
  if (Number(head.ContentLength) !== expected.bytes || head.ContentType !== expected.type
      || actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) {
    throw new Error("T109 MinIO target object failed its pinned license/hash receipt");
  }

  const school = await prisma.school.findUnique({ where: { code: "default-school" }, select: { id: true } });
  const course = school ? await prisma.course.findFirst({
    where: { schoolId: school.id, stableKey: "t109-course-video-acceptance" },
    include: { versions: { where: { version: 1, status: "PUBLISHED" }, include: {
      units: { include: { lessons: { include: { activities: true } } } },
    } } },
  }) : null;
  const videos = course?.versions?.[0]?.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities))
    .filter((activity) => activity.type === "VIDEO") || [];
  if (!school || !course || videos.length !== 1) throw new Error("Expected the single published T109 video activity");
  const links = await prisma.activityResource.findMany({
    where: { activityId: videos[0].id },
    include: { resource: true },
  });
  if (links.length !== 1) throw new Error("Expected exactly one resource link on the T109 video activity");
  const resource = links[0].resource;
  if (resource.schoolId !== school.id || resource.kind !== "VIDEO" || resource.rightsStatus !== "APPROVED") {
    throw new Error("Refusing to modify a non-T109 or unapproved resource row");
  }

  const updated = await prisma.resource.update({
    where: { id: resource.id },
    data: {
      objectKey: expected.key,
      originalName: expected.name,
      mediaType: expected.type,
      byteSize: BigInt(expected.bytes),
      checksumSha256: expected.sha256,
      rightsNote: expected.note,
    },
    select: { id: true, schoolId: true, objectKey: true, originalName: true, mediaType: true,
      byteSize: true, checksumSha256: true, rightsStatus: true },
  });
  const result = {
    taskId: "YZ-RD-T109",
    status: "PASS",
    scope: "single approved resource linked to the T109 video activity",
    target,
    activityIdPrefix: prefix(videos[0].id),
    resourceIdPrefix: prefix(updated.id),
    schoolIdPrefix: prefix(updated.schoolId),
    objectKey: updated.objectKey,
    mediaType: updated.mediaType,
    byteSize: Number(updated.byteSize),
    checksumSha256: updated.checksumSha256,
    rightsStatus: updated.rightsStatus,
    minioDirectGetMatched: true,
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await prisma.$disconnect();
  await pool.end();
  s3.destroy();
}
