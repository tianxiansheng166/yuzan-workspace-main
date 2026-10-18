import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const requireFromApi = createRequire(resolve(root, 'backend/api/package.json'));
const {
  CopyObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  S3Client,
} = requireFromApi('@aws-sdk/client-s3');

const endpoint = process.env.S3_ENDPOINT;
const sourceBucket = 'yz-t011-native';
const targetBucket = process.env.S3_BUCKET;
if (!endpoint || targetBucket !== 'yz-t018-native') {
  throw new Error('T018 S3 endpoint or bucket identity is invalid.');
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

async function listKeys(bucket) {
  const keys = new Set();
  let continuationToken;
  do {
    const response = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken,
    }));
    for (const object of response.Contents || []) {
      if (object.Key) keys.add(object.Key);
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

function copySourceFor(key) {
  return `/${sourceBucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

async function run() {
  try {
    try {
      await client.send(new HeadBucketCommand({ Bucket: targetBucket }));
    } catch {
      await client.send(new CreateBucketCommand({ Bucket: targetBucket }));
    }

    const [sourceKeys, targetKeys] = await Promise.all([
      listKeys(sourceBucket),
      listKeys(targetBucket),
    ]);
    if (sourceKeys.size === 0) throw new Error('The retained T011 bucket has no fixture objects.');
    const missing = [...sourceKeys].filter((key) => !targetKeys.has(key));
    for (let offset = 0; offset < missing.length; offset += 5) {
      await Promise.all(missing.slice(offset, offset + 5).map((key) => client.send(new CopyObjectCommand({
        Bucket: targetBucket,
        Key: key,
        CopySource: copySourceFor(key),
      }))));
    }
    if ((await listKeys(targetBucket)).size < sourceKeys.size) {
      throw new Error('T018 bucket verification found missing retained fixture objects.');
    }
    process.stdout.write(JSON.stringify({
      sourceBucket,
      targetBucket,
      sourceObjects: sourceKeys.size,
      copiedObjects: missing.length,
      bucket: 'verified',
    }));
  } finally {
    client.destroy();
  }
}

run().catch((error) => {
  process.stderr.write(`${error.name || 'T018_BUCKET_ERROR'}: ${error.message || 'Bucket preparation failed'}\n`);
  process.exitCode = 1;
});
