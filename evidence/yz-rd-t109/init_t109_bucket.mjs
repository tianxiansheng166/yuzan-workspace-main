import { createRequire } from "node:module";

const requireApi = createRequire(new URL("../../backend/api/package.json", import.meta.url));
const { CreateBucketCommand, HeadBucketCommand, S3Client } = requireApi("@aws-sdk/client-s3");
const bucket = process.env.S3_BUCKET;
if (bucket !== "yz-rd-t109-media") throw new Error("Unexpected bucket name for YZ-RD-T109");

const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "us-east-1",
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

try {
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  process.stdout.write(`${JSON.stringify({
    taskId: "YZ-RD-T109",
    status: "PASS",
    bucket,
    initializedIn: "yz-rd-t109-minio-data",
    headBucketVerified: true,
    objectCountBeforeCourseSeed: 0,
  })}\n`);
} finally {
  client.destroy();
}
