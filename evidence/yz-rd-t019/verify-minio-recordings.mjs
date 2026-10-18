import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const requireFromApi = createRequire(new URL("../../backend/api/package.json", import.meta.url));
const { GetObjectCommand, HeadObjectCommand, S3Client } = requireFromApi("@aws-sdk/client-s3");

const recordingObjects = [
  ["T011-reviewed-1", "b7ba2bbf-e50f-4603-bf13-85c781b1a6bb"],
  ["T011-reviewed-2", "3b0b3f3f-e7c7-436f-b9a5-0705289bfb85"],
  ["T011-reviewed-3", "a5bbfaaf-986f-47a1-bdca-5fae4f6b7a90"],
  ["T011-reviewed-4", "c51ed04e-3e12-443b-b676-e49ea8614b9a"],
  ["T008-processing-1", "050bd722-6c78-45a4-9a7c-54855ccc2afa"],
  ["T008-processing-2", "89906d3a-8d2b-4b9d-8af4-abf00cfa1dce"],
  ["T008-processing-3", "a9f2258a-1a14-429a-be06-cb2172c7a457"],
  ["T008-processing-4", "c0b1d221-d640-41ec-bb7f-39950926cc59"],
  ["T012-processing-1", "89c8914a-79d1-4ea8-8707-61be71d4e27a"],
  ["T012-processing-2", "98d1026a-6bbc-45f6-92be-0655cceca6e6"],
  ["T012-processing-3", "d80f68c8-2750-458b-9809-a670f26a30f9"],
  ["T012-processing-4", "dc79fd0a-e7fc-4ea4-adb9-cfce306dd375"],
  ["T014-class-evidence", "452d3bd2-833b-41f9-a556-126feb15dc3a"],
];

const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});

try {
  const objects = [];
  for (const [flow, recordingId] of recordingObjects) {
    const key = `recordings/${recordingId}/full`;
    const input = { Bucket: process.env.S3_BUCKET, Key: key };
    const head = await client.send(new HeadObjectCommand(input));
    const result = await client.send(new GetObjectCommand(input));
    const bytes = Buffer.from(await result.Body.transformToByteArray());
    if (bytes.length !== head.ContentLength || !head.ContentType?.startsWith("audio/")) {
      throw new Error(`Object metadata mismatch: ${recordingId}`);
    }
    objects.push({
      flow,
      recordingId,
      key,
      bytes: bytes.length,
      contentType: head.ContentType,
      etag: head.ETag,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  process.stdout.write(JSON.stringify({ bucket: process.env.S3_BUCKET, objectCount: objects.length, objects }, null, 2) + "\n");
} finally {
  client.destroy();
}
