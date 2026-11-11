import { NextResponse } from "next/server";
import { bucketAccess } from "@/lib/objects";
import { objectUrl, validObjectKey } from "@/lib/s3";

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!(await bucketAccess(name))) return new Response("Not found", { status: 404 });
  const key = new URL(request.url).searchParams.get("key");
  if (!key || !validObjectKey(key)) return new Response("Invalid object", { status: 400 });
  try {
    return NextResponse.redirect(await objectUrl(name, key, "get"), {
      headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
  } catch {
    return new Response("Unable to download object", { status: 502 });
  }
}
