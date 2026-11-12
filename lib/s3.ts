import "server-only";
import {
  HeadObjectCommand,
  DeleteObjectCommand,
  ListMultipartUploadsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from "node:crypto";
import { account, apiToken, cf, cloudflareConfigured, r2Endpoint } from "./cloudflare";
import { hasControl } from "./format";

// R2 S3 credentials are derived from the Cloudflare API token:
// access key ID = token ID, secret access key = SHA-256 hex of the token value.
async function tokenId() {
  for (const path of [`accounts/${account}/tokens/verify`, "user/tokens/verify"]) {
    const { ok, data } = await cf(path);
    if (ok && typeof data.result?.id === "string") return data.result.id as string;
  }
  throw new Error("Unable to verify the Cloudflare API token");
}

let s3: Promise<S3Client> | undefined;
function client() {
  if (!cloudflareConfigured()) throw new Error("R2 S3 access is not configured");
  s3 ??= tokenId().then(
    (accessKeyId) =>
      new S3Client({
        region: "auto",
        endpoint: r2Endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey: createHash("sha256").update(apiToken!).digest("hex"),
        },
      }),
  );
  // Retry verification on the next call if it failed.
  s3.catch(() => (s3 = undefined));
  return s3;
}
const media =
  "image/png image/jpeg image/gif image/webp image/avif image/bmp video/mp4 video/webm audio/mpeg audio/ogg audio/wav".split(
    " ",
  );
const text = ["application/json", "application/xml", "application/javascript"];

export const validObjectKey = (key: string) =>
  key.length > 0 && Buffer.byteLength(key) <= 1024 && !hasControl(key);

export const maxUploadSize = 300 * 1024 * 1024;

export const objectUrl = async (
  Bucket: string,
  Key: string,
  method: "get" | "put",
  { size, expiresIn = 60 }: { size?: number; expiresIn?: number } = {},
) =>
  method === "get"
    ? getSignedUrl(
        await client(),
        new GetObjectCommand({ Bucket, Key, ResponseContentDisposition: "attachment" }),
        { expiresIn },
      )
    : getSignedUrl(await client(), new PutObjectCommand({ Bucket, Key, ContentLength: size }), {
        expiresIn,
        signableHeaders: new Set(["content-length"]),
      });

export async function readObject(Bucket: string, Key: string, limit: number) {
  const r = await (
    await client()
  ).send(new GetObjectCommand({ Bucket, Key, Range: `bytes=0-${limit - 1}` }));
  const size = Number(r.ContentRange?.split("/")[1] ?? r.ContentLength);
  return {
    body: (await r.Body?.transformToByteArray()) ?? new Uint8Array(),
    size,
    contentType: r.ContentType || "application/octet-stream",
  };
}

export async function writeObject(
  Bucket: string,
  Key: string,
  Body: Uint8Array,
  ContentType: string,
  overwrite: boolean,
) {
  const r = await (
    await client()
  ).send(
    new PutObjectCommand({
      Bucket,
      Key,
      Body,
      ContentType,
      ContentLength: Body.byteLength,
      ...(!overwrite && { IfNoneMatch: "*" }),
    }),
  );
  return { etag: r.ETag };
}

export async function removeObject(Bucket: string, Key: string) {
  await (await client()).send(new DeleteObjectCommand({ Bucket, Key }));
}

export async function putFolder(Bucket: string, Key: string) {
  await (
    await client()
  ).send(new PutObjectCommand({ Bucket, Key, Body: "", ContentLength: 0, IfNoneMatch: "*" }));
}

export async function hasMultipartUploads(Bucket: string) {
  const r = await (await client()).send(new ListMultipartUploadsCommand({ Bucket, MaxUploads: 1 }));
  return (r.Uploads?.length ?? 0) > 0 || !!r.IsTruncated;
}

export async function objectDetails(Bucket: string, Key: string) {
  const r = await (await client()).send(new HeadObjectCommand({ Bucket, Key }));
  return {
    size: r.ContentLength,
    modified: r.LastModified,
    contentType: r.ContentType || "application/octet-stream",
    storageClass: r.StorageClass || "STANDARD",
    metadata: r.Metadata || {},
    etag: r.ETag,
  };
}

export async function objectPreview(Bucket: string, Key: string, type: string, size: number) {
  if (media.includes(type))
    return {
      url: await getSignedUrl(
        await client(),
        new GetObjectCommand({
          Bucket,
          Key,
          ResponseContentDisposition: "inline",
          ResponseContentType: type,
        }),
        { expiresIn: 300 },
      ),
    };
  if (size > 0 && (type.startsWith("text/") || text.includes(type))) {
    const r = await (
      await client()
    ).send(new GetObjectCommand({ Bucket, Key, Range: "bytes=0-65535" }));
    return { text: await r.Body?.transformToString(), truncated: size > 65536 };
  }
  return null;
}
