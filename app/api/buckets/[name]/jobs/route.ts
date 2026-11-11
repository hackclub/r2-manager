import { bucketAccess } from "@/lib/objects";
import { bucketSetting } from "@/lib/cloudflare";

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!(await bucketAccess(name))) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const { jobs } = await bucketSetting<{ jobs: unknown[] }>(name, "/jobs?per_page=10");
    return Response.json(
      { jobs: jobs || [] },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json({ error: "Unable to refresh jobs" }, { status: 502 });
  }
}
