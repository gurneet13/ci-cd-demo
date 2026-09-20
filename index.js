// index.js
import "dotenv/config";
import express from "express";
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
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
const PORT = process.env.PORT || 8080;

async function ensureBucket() {
  try {
    console.log(`Creating bucket "${BUCKET}"...`);
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
    console.log(`Bucket "${BUCKET}" created`);
  } catch (err) {
    if (err.name !== "BucketAlreadyOwnedByYou") throw err;
    console.log(`Bucket "${BUCKET}" already exists`);
  }
}

const app = express();

app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/ready", async (req, res) => {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
    res.status(200).json({ status: "ready" });
  } catch (err) {
    res.status(503).json({ status: "not ready", error: err.message });
  }
});

app.put("/objects/:key", express.raw({ type: "*/*", limit: "10mb" }), async (req, res) => {
  const { key } = req.params;
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: req.body,
        ContentType: req.headers["content-type"] || "application/octet-stream",
      })
    );
    res.status(201).json({ key });
  } catch (err) {
    console.error(`Error putting object "${key}":`, err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/objects/:key", async (req, res) => {
  const { key } = req.params;
  try {
    const result = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const body = await result.Body.transformToByteArray();
    res.status(200)
      .type(result.ContentType || "application/octet-stream")
      .send(Buffer.from(body));
  } catch (err) {
    if (err.name === "NoSuchKey") {
      res.status(404).json({ error: `Object "${key}" not found` });
    } else {
      console.error(`Error getting object "${key}":`, err);
      res.status(500).json({ error: err.message });
    }
  }
});

let server;

async function main() {
  await ensureBucket();
  server = app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

function shutdown(signal) {
  console.log(`Received ${signal}, shutting down...`);
  if (!server) process.exit(0);
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
