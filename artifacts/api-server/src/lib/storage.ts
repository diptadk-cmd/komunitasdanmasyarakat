import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { logger } from "./logger";

const BUCKET = process.env["S3_BUCKET"] ?? "jak-sanggar";
const ENDPOINT = process.env["S3_ENDPOINT"];
const REGION = process.env["S3_REGION"] ?? "us-east-1";
const ACCESS_KEY = process.env["S3_ACCESS_KEY"];
const SECRET_KEY = process.env["S3_SECRET_KEY"];
const CONFIGURED_LOCAL_DIR = process.env["LOCAL_STORAGE_DIR"]?.trim();

const useS3 = Boolean(ENDPOINT && ACCESS_KEY && SECRET_KEY);

if (!useS3 && process.env["NODE_ENV"] === "production" && !CONFIGURED_LOCAL_DIR) {
  throw new Error(
    "Production storage belum dikonfigurasi. Set seluruh S3_* atau LOCAL_STORAGE_DIR.",
  );
}

let s3: S3Client | null = null;
if (useS3) {
  s3 = new S3Client({
    region: REGION,
    endpoint: ENDPOINT,
    credentials: { accessKeyId: ACCESS_KEY!, secretAccessKey: SECRET_KEY! },
    forcePathStyle: true,
  });
  logger.info({ endpoint: ENDPOINT, bucket: BUCKET }, "Storage: MinIO/S3 aktif");
} else {
  logger.info(
    { directory: CONFIGURED_LOCAL_DIR ?? "/tmp/jak-uploads" },
    CONFIGURED_LOCAL_DIR
      ? "Storage: filesystem persisten aktif"
      : "Storage: filesystem development aktif",
  );
}

const LOCAL_DIR = resolve(CONFIGURED_LOCAL_DIR ?? "/tmp/jak-uploads");

async function ensureLocalDir() {
  if (!existsSync(LOCAL_DIR)) {
    await mkdir(LOCAL_DIR, { recursive: true });
  }
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  if (s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return;
  }
  await ensureLocalDir();
  await writeFile(join(LOCAL_DIR, key), body);
}

export async function getObject(
  key: string,
): Promise<{ body: Buffer; contentType: string; sizeBytes: number } | null> {
  if (s3) {
    try {
      const head = await s3.send(
        new HeadObjectCommand({ Bucket: BUCKET, Key: key }),
      );
      const obj = await s3.send(
        new GetObjectCommand({ Bucket: BUCKET, Key: key }),
      );
      const stream = obj.Body as NodeJS.ReadableStream | undefined;
      if (!stream) return null;
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const body = Buffer.concat(chunks);
      return {
        body,
        contentType: head.ContentType ?? "application/octet-stream",
        sizeBytes: head.ContentLength ?? body.length,
      };
    } catch {
      return null;
    }
  }
  await ensureLocalDir();
  const path = join(LOCAL_DIR, key);
  if (!existsSync(path)) return null;
  const body = await readFile(path);
  const st = await stat(path);
  return { body, contentType: "application/octet-stream", sizeBytes: st.size };
}

export function buildDownloadUrl(uploadId: string): string {
  return `/api/uploads/${uploadId}/raw`;
}
