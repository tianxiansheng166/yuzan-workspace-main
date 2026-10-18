import { randomUUID } from "node:crypto";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const required = ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

const bucket = process.env.S3_BUCKET;
const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});

try {
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
} catch (error) {
  if (!["NotFound", "NoSuchBucket", "404"].includes(error.name) && error.$metadata?.httpStatusCode !== 404) {
    throw error;
  }
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
}

const key = `t009-smoke/${randomUUID()}.txt`;
const expected = Buffer.from("YZ-RD-T009 isolated MinIO smoke check\n", "utf8");
try {
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: expected, ContentType: "text/plain" }));
  const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = Buffer.from(await object.Body.transformToByteArray());
  if (!body.equals(expected)) throw new Error("MinIO object read-back bytes differ");

  const signedUrl = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 120 });
  const signedResponse = await fetch(signedUrl);
  if (!signedResponse.ok) throw new Error(`Signed URL returned HTTP ${signedResponse.status}`);
  const signedBody = Buffer.from(await signedResponse.arrayBuffer());
  if (!signedBody.equals(expected)) throw new Error("Signed URL read-back bytes differ");
} finally {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  client.destroy();
}

console.log(`MinIO S3 PASS: bucket=${bucket}; upload/read-back/signed-GET=${expected.length} bytes`);
