import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const requireFromApi = createRequire(resolve(root, 'backend/api/package.json'));
const {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} = requireFromApi('@aws-sdk/client-s3');

const endpoint = process.env.S3_ENDPOINT;
const bucket = process.env.S3_BUCKET;
if (!endpoint || bucket !== 'yz-t047-native') {
  throw new Error('T050 requires its isolated MinIO clone of the accepted T047 resource bucket.');
}

const client = new S3Client({
  endpoint,
  region: process.env.S3_REGION || 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});

async function run() {
  const probeKey = `t050-probe/${randomUUID()}.txt`;
  let probeWritten = false;
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    const listed = await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }));
    const seedObject = listed.Contents?.[0];
    if (!seedObject?.Key) throw new Error('The cloned T047 resource bucket has no readable fixture object.');
    const seedHead = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: seedObject.Key }));
    if (!Number(seedHead.ContentLength)) throw new Error('The cloned T047 fixture object is empty.');

    const probeText = `TEST_FIXTURE_ONLY T050 MinIO round trip ${randomUUID()}`;
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: probeKey, Body: probeText, ContentType: 'text/plain' }));
    probeWritten = true;
    const fetched = await client.send(new GetObjectCommand({ Bucket: bucket, Key: probeKey }));
    const readBack = await fetched.Body.transformToString();
    if (readBack !== probeText) throw new Error('T050 MinIO read-back differs from the written probe.');

    process.stdout.write(JSON.stringify({
      isolatedRuntime: 'T050-owned cloned MinIO data directory',
      clonedResourceBucket: bucket,
      sourceFixtureReadable: true,
      sourceFixtureBytes: Number(seedHead.ContentLength),
      probeWrite: 'PASS',
      probeReadBack: 'PASS',
    }));
  } finally {
    if (probeWritten) await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: probeKey }));
    client.destroy();
  }
}

run().catch((error) => {
  process.stderr.write(`${error.name || 'T050_MINIO_PROBE_FAILED'}: ${error.message || 'MinIO probe failed'}\n`);
  process.exitCode = 1;
});
