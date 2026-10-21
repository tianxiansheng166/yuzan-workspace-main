import { createHash } from "node:crypto";
import { createReadStream, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";

const requireApi = createRequire(new URL("../../backend/api/package.json", import.meta.url));
const { PrismaClient } = requireApi("@yuzan/database");
const { PrismaPg } = requireApi("@prisma/adapter-pg");
const { Pool } = requireApi("pg");
const {
  GetObjectCommand,
  HeadBucketCommand,
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

async function hashStream(stream) {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of stream) hash.update(Buffer.from(chunk));
  return hash.digest("hex");
}

const bucket = required("S3_BUCKET");
if (bucket !== "yz-rd-t109-media") throw new Error("Unexpected bucket name for YZ-RD-T109");
const oldObjectKey = "t109-native-acceptance/flower.mp4";
const objectKey = "t109-native-acceptance/flower.webm";
const mediaPath = "/seed/flower.webm";
const mediaStats = statSync(mediaPath);
const mediaBytes = readFileSync(mediaPath);
const mediaHash = createHash("sha256").update(mediaBytes).digest("hex");
const expectedHash = "c6f8a348953395598a9a73b9bab1676436410797bce9f398f4be1531d6e76dda";
if (mediaBytes.length !== 554058 || mediaHash !== expectedHash) throw new Error("T109 WebM source receipt did not match the pinned CC0 file");

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
  await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  let targetObjectExists = false;
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
    targetObjectExists = true;
    if (Number(head.ContentLength) !== mediaStats.size || head.ContentType !== "video/webm") {
      throw new Error("Existing T109 WebM object metadata does not match the pinned source");
    }
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode;
    if (status !== 404 && error?.name !== "NotFound" && error?.name !== "NoSuchKey") throw error;
  }

  if (!targetObjectExists) {
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: createReadStream(mediaPath),
      ContentLength: mediaStats.size,
      ContentType: "video/webm",
      Metadata: { license: "CC0-1.0", source: "mdn-interactive-examples" },
    }));
  }
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
  const readHash = await hashStream(object.Body);
  if (Number(head.ContentLength) !== mediaStats.size || readHash !== expectedHash) {
    throw new Error("T109 MinIO WebM readback did not match the pinned CC0 source");
  }

  const school = await prisma.school.findUnique({ where: { code: "default-school" } });
  const resource = await prisma.resource.findUnique({ where: { objectKey: oldObjectKey } });
  if (!school || !resource || resource.schoolId !== school.id || resource.rightsStatus !== "APPROVED") {
    throw new Error("T109-owned approved course resource is missing; no unrelated row was changed");
  }
  if (resource.objectKey === objectKey && resource.mediaType === "video/webm" && resource.checksumSha256 === expectedHash) {
    process.stdout.write(`${JSON.stringify({ taskId: "YZ-RD-T109", status: "PASS", resourceIdPrefix: prefix(resource.id), alreadyUpdated: true, mediaType: "video/webm", objectKey, bytes: mediaStats.size, sha256: readHash, headContentType: head.ContentType, oldMp4ObjectPreserved: true })}\n`);
  } else {
    const updated = await prisma.resource.update({
      where: { id: resource.id },
      data: {
        objectKey,
        originalName: "flower.webm",
        mediaType: "video/webm",
        byteSize: BigInt(mediaStats.size),
        checksumSha256: expectedHash,
        rightsNote: "MDN interactive-examples flower.webm; CC0-1.0; VP8/Vorbis compatibility asset. Both source and license are recorded in evidence/yz-rd-t109/media-license.json.",
      },
    });
    process.stdout.write(`${JSON.stringify({ taskId: "YZ-RD-T109", status: "PASS", resourceIdPrefix: prefix(updated.id), alreadyUpdated: false, mediaType: updated.mediaType, objectKey, bytes: mediaStats.size, sha256: readHash, headContentType: head.ContentType, oldMp4ObjectPreserved: true })}\n`);
  }
} finally {
  await prisma.$disconnect();
  await pool.end();
  s3.destroy();
}
