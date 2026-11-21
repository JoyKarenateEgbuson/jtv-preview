import { deleteVideoRecords, getVideo, updateVideo } from "@/lib/repo";
import { adminDenied } from "@/lib/session";
import { removeFile } from "@/lib/storage";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await adminDenied();
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!(await getVideo(id))) return Response.json({ error: "Not found" }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Whitelist what can change.
  const patch: Record<string, unknown> = {};
  if (typeof b.title === "string" && b.title.trim()) patch.title = b.title.trim().slice(0, 120);
  if (typeof b.fps === "number" && b.fps >= 1 && b.fps <= 120) patch.fps = b.fps;
  if (typeof b.watermark === "boolean") patch.watermark = b.watermark;
  if (typeof b.allowDownload === "boolean") patch.allowDownload = b.allowDownload;
  if (Array.isArray(b.personIds) && b.personIds.every((p) => typeof p === "string")) {
    patch.personIds = b.personIds;
  }
  await updateVideo(id, patch);
  return Response.json(await getVideo(id));
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await adminDenied();
  if (denied) return denied;
  const { id } = await ctx.params;
  const video = await getVideo(id);
  if (!video) return Response.json({ error: "Not found" }, { status: 404 });
  await removeFile(video);
  await deleteVideoRecords(id);
  return Response.json({ ok: true });
}
