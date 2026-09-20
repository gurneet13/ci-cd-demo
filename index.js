// s3-test.js
import "dotenv/config";
import {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

const s3 = new S3Client({
  endpoint: process.env.AWS_ENDPOINT_URL,
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.S3_BUCKET;
const KEY = "hello.txt";

async function main() {
  try {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
    console.log(`Bucket "${BUCKET}" created`);
  } catch (err) {
    if (err.name !== "BucketAlreadyOwnedByYou") throw err;
    console.log(`Bucket "${BUCKET}" already exists`);
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: KEY,
      Body: "Hello from Floci!",
      ContentType: "text/plain",
    })
  );
  console.log(`Put object "${KEY}"`);

  const result = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: KEY })
  );
  const body = await result.Body.transformToString();
  console.log(`Got object "${KEY}":`, body);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
