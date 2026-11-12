import "server-only";
import {
  McpServer,
  requireScopes,
  type CallToolResult,
  type ToolCallback,
} from "@modelcontextprotocol/server";
import * as z from "zod";
import type { Access } from "../access";
import { hasBucketRole, type BucketRole } from "../bucket-policy";
import { listBuckets } from "../buckets";
import { bucketRole, listObjects } from "../objects";
import {
  maxUploadSize,
  objectDetails,
  objectUrl,
  putFolder,
  readObject,
  removeObject,
  validObjectKey,
  writeObject,
} from "../s3";

const maxRead = 1024 * 1024;
const maxInlineWrite = 2 * 1024 * 1024;
const textual = /^(text\/|application\/(json|xml|javascript|yaml|toml|x-ndjson)|image\/svg\+xml)/;
const visual = /^image\/(png|jpeg|gif|webp)$/;

class ToolError extends Error {}

const failures: Record<string, string> = {
  NoSuchKey: "Object not found.",
  NotFound: "Object not found.",
  NoSuchBucket: "Bucket not found.",
  PreconditionFailed: "An object already exists at this key. Pass overwrite: true to replace it.",
  InvalidRange: "The object is empty.",
};

const result = (data: Record<string, unknown>): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  structuredContent: data,
});

const failure = (error: unknown): CallToolResult => ({
  isError: true,
  content: [
    {
      type: "text",
      text:
        error instanceof ToolError
          ? error.message
          : (failures[(error as { name?: string })?.name ?? ""] ??
            "Cloudflare could not complete the request. Try again."),
    },
  ],
});

const bucket = z.string().min(3).max(63).describe("Bucket name");
const key = z
  .string()
  .refine(validObjectKey, "Object keys are 1–1024 bytes with no control characters.")
  .describe("Full object key, including any folder prefix");

export function mcpServer(access: Access) {
  const server = new McpServer(
    { name: "r2-manager", title: "R2 Manager", version: "1.0.0" },
    {
      instructions:
        "Manage Cloudflare R2 buckets shared with you in Hack Club's R2 Manager. Start with list_buckets. " +
        "Folders are key prefixes ending in '/'. Your role on each bucket (viewer, editor, manager) limits what you can change, " +
        "and destructive changes cannot be undone, so confirm with the user before deleting or overwriting objects.",
    },
  );

  const within = async <T>(name: string, required: BucketRole, fn: () => Promise<T>) => {
    const role = await bucketRole(access, name);
    if (!role) throw new ToolError("Bucket not found.");
    if (!hasBucketRole(role, required))
      throw new ToolError(`This needs the ${required} role on ${name}; your role is ${role}.`);
    return fn();
  };

  const tool = <S extends z.ZodObject>(
    name: string,
    config: {
      title: string;
      description: string;
      inputSchema: S;
      write?: boolean;
      destructive?: boolean;
      idempotent?: boolean;
    },
    run: (input: z.output<S>) => Promise<Record<string, unknown> | CallToolResult>,
  ) =>
    server.registerTool(
      name,
      {
        title: config.title,
        description: config.description,
        inputSchema: config.inputSchema,
        annotations: {
          readOnlyHint: !config.write,
          destructiveHint: !!config.destructive,
          idempotentHint: config.idempotent ?? !config.write,
          openWorldHint: false,
        },
        scopeChallenge: requireScopes(config.write ? "r2:write" : "r2:read"),
      },
      (async (input: z.output<S>) => {
        try {
          const out = await run(input);
          return "content" in out ? (out as CallToolResult) : result(out);
        } catch (error) {
          return failure(error);
        }
      }) as ToolCallback<S>,
    );

  tool(
    "list_buckets",
    {
      title: "List buckets",
      description: "List the R2 buckets you can access and your role on each.",
      inputSchema: z.object({}),
    },
    async () => ({
      buckets: (await listBuckets(access)).map(({ name, status, role, created_at }) => ({
        name,
        status,
        role,
        createdAt: created_at.toISOString(),
      })),
    }),
  );

  tool(
    "list_objects",
    {
      title: "List objects",
      description:
        "List up to 100 objects in a bucket. By default, lists one folder level; pass recursive to list every key under the prefix.",
      inputSchema: z.object({
        bucket,
        prefix: z.string().max(1024).default("").describe("Only list keys starting with this"),
        recursive: z.boolean().default(false),
        cursor: z.string().optional().describe("Cursor from a previous page"),
      }),
    },
    ({ bucket, prefix, recursive, cursor }) =>
      within(bucket, "viewer", async () => {
        const page = await listObjects(bucket, prefix, cursor, !recursive);
        return {
          objects: page.objects.map((o) => ({
            key: o.key,
            size: o.size,
            lastModified: o.last_modified,
            contentType: o.http_metadata?.contentType,
          })),
          folders: page.folders,
          ...(page.cursor && { cursor: page.cursor }),
        };
      }),
  );

  tool(
    "get_object_info",
    {
      title: "Get object info",
      description: "Get an object's size, content type, ETag, storage class, and custom metadata.",
      inputSchema: z.object({ bucket, key }),
    },
    ({ bucket, key }) =>
      within(bucket, "viewer", async () => {
        const { modified, ...details } = await objectDetails(bucket, key);
        return { key, ...details, lastModified: modified?.toISOString() };
      }),
  );

  tool(
    "read_object",
    {
      title: "Read object",
      description:
        "Read a text object (up to 1 MB, longer objects are truncated) or view a PNG, JPEG, GIF, or WebP image up to 1 MB. Use create_download_url for anything else.",
      inputSchema: z.object({ bucket, key }),
    },
    ({ bucket, key }) =>
      within(bucket, "viewer", async () => {
        const { body, size, contentType } = await readObject(bucket, key, maxRead);
        const type = contentType.split(";")[0].trim().toLowerCase();
        if (visual.test(type)) {
          if (size > maxRead) throw new ToolError("Images over 1 MB cannot be viewed inline.");
          return {
            content: [
              { type: "image", data: Buffer.from(body).toString("base64"), mimeType: type },
            ],
          };
        }
        if (!textual.test(type))
          throw new ToolError(
            `${type} objects cannot be read as text. Use create_download_url instead.`,
          );
        const text = new TextDecoder("utf-8", { fatal: false }).decode(body);
        return {
          content: [
            {
              type: "text",
              text: size > maxRead ? `${text}\n\n[Truncated: showing 1 MB of ${size} bytes]` : text,
            },
          ],
        };
      }),
  );

  tool(
    "create_download_url",
    {
      title: "Create download link",
      description:
        "Create a presigned link anyone can use to download the object until it expires. Only share it with people who should see the object.",
      inputSchema: z.object({
        bucket,
        key,
        expiresIn: z
          .number()
          .int()
          .min(60)
          .max(3600)
          .default(300)
          .describe("Seconds until the link expires"),
      }),
    },
    ({ bucket, key, expiresIn }) =>
      within(bucket, "viewer", async () => ({
        url: await objectUrl(bucket, key, "get", { expiresIn }),
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      })),
  );

  tool(
    "put_object",
    {
      title: "Upload object",
      description:
        "Write up to 2 MB of UTF-8 text or base64 data to a key. Refuses to replace an existing object unless overwrite is true. Use create_upload_url for larger files.",
      inputSchema: z.object({
        bucket,
        key,
        content: z.string(),
        encoding: z.enum(["utf8", "base64"]).default("utf8"),
        contentType: z
          .string()
          .regex(/^[\w.+-]+\/[\w.+-]+(;\s*[\w.+-]+=[\w.+-]+)*$/)
          .max(255)
          .default("text/plain; charset=utf-8"),
        overwrite: z.boolean().default(false),
      }),
      write: true,
      destructive: true,
    },
    ({ bucket, key, content, encoding, contentType, overwrite }) =>
      within(bucket, "editor", async () => {
        if (encoding === "base64" && !/^[A-Za-z0-9+/]*={0,2}$/.test(content))
          throw new ToolError("content is not valid base64.");
        const body = Buffer.from(content, encoding);
        if (body.byteLength > maxInlineWrite)
          throw new ToolError("Content over 2 MB must be uploaded with create_upload_url.");
        const { etag } = await writeObject(bucket, key, body, contentType, overwrite);
        return { key, size: body.byteLength, contentType, etag };
      }),
  );

  tool(
    "create_upload_url",
    {
      title: "Create upload link",
      description:
        "Create a presigned PUT link, valid for 10 minutes, for uploading a file of exactly `size` bytes (up to 300 MB). The request must send a matching Content-Length header. Replaces any existing object at the key.",
      inputSchema: z.object({
        bucket,
        key,
        size: z.number().int().min(0).max(maxUploadSize).describe("Exact file size in bytes"),
      }),
      write: true,
      destructive: true,
    },
    ({ bucket, key, size }) =>
      within(bucket, "editor", async () => ({
        url: await objectUrl(bucket, key, "put", { size, expiresIn: 600 }),
        method: "PUT",
        headers: { "Content-Length": String(size) },
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      })),
  );

  tool(
    "create_folder",
    {
      title: "Create folder",
      description: "Create an empty folder marker. The path must end with '/'.",
      inputSchema: z.object({
        bucket,
        path: key.refine((k) => k.endsWith("/") && !k.startsWith("/"), "End the path with '/'."),
      }),
      write: true,
      idempotent: true,
    },
    ({ bucket, path }) =>
      within(bucket, "editor", async () => {
        const created = await putFolder(bucket, path).then(
          () => true,
          (error) => {
            if ((error as { name?: string })?.name === "PreconditionFailed") return false;
            throw error;
          },
        );
        return { folder: path, created };
      }),
  );

  tool(
    "delete_object",
    {
      title: "Delete object",
      description: "Permanently delete one object. This cannot be undone.",
      inputSchema: z.object({ bucket, key }),
      write: true,
      destructive: true,
      idempotent: true,
    },
    ({ bucket, key }) =>
      within(bucket, "editor", async () => {
        await removeObject(bucket, key);
        return { deleted: key };
      }),
  );

  return server;
}
