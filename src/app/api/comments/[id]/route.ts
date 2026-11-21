import type { NextRequest } from "next/server";
import { authorize } from "@/lib/access";
import { deleteComment, getComment, updateComment } from "@/lib/repo";

async function load(req: NextRequest, id: string) {
  const t = req.nextUrl.searchParams.get("t");
  const auth = await authorize(t);
  const comment = await getComment(id);
  if (!auth || !comment || comment.videoId !== auth.video.id) return null;
  if (comment.internal && !auth.perms.internal) return null;
  return { auth, comment };
}

// Anyone with access can mark a comment resolved/unresolved.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const found = await load(req, id);
  if (!found) return Response.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { resolved?: boolean };
  if (typeof body.resolved !== "boolean") {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }
  await updateComment(id, { resolved: body.resolved });
  return Response.json({ ...found.comment, resolved: body.resolved });
}

// Admin can delete anything; others can delete only their own comments.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const found = await load(req, id);
  if (!found) return Response.json({ error: "Not found" }, { status: 404 });
  const own = found.comment.author === found.auth.viewer.name && found.comment.role === found.auth.viewer.role;
  if (found.auth.viewer.role !== "admin" && !own) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  await deleteComment(found.comment);
  return Response.json({ ok: true });
}
