import type { NextRequest } from "next/server";
import { authorize } from "@/lib/access";
import { deleteComment, getComment, updateComment } from "@/lib/repo";

async function load(req: NextRequest, id: string) {
  const t = req.nextUrl.searchParams.get("t");
  const auth = await authorize(t);
  const comment = await getComment(id);
  if (!auth || !comment || comment.videoId !== auth.video.id) return null;
  if (comment.internal && !auth.perms.internal) return null;
  const isAuthor = comment.author === auth.viewer.name && comment.role === auth.viewer.role;
  return { auth, comment, isAuthor, isAdmin: auth.viewer.role === "admin" };
}

/**
 * - `resolved`: ADMIN only. Clients can see that a comment is resolved but cannot change it.
 * - `text`: the comment's own author only (the admin can edit their own, not other people's).
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const found = await load(req, id);
  if (!found) return Response.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { resolved?: boolean; text?: string };

  if (typeof body.resolved === "boolean") {
    if (!found.isAdmin) return Response.json({ error: "Only the team can resolve comments" }, { status: 403 });
    await updateComment(id, { resolved: body.resolved });
    return Response.json({ ...found.comment, resolved: body.resolved });
  }

  if (typeof body.text === "string") {
    if (!found.isAuthor) return Response.json({ error: "You can only edit your own comments" }, { status: 403 });
    const text = body.text.trim();
    if (!text || text.length > 2000) {
      return Response.json({ error: "Comment must be 1–2000 characters" }, { status: 400 });
    }
    const editedAt = Date.now();
    await updateComment(id, { text, editedAt });
    return Response.json({ ...found.comment, text, editedAt });
  }

  return Response.json({ error: "Nothing to update" }, { status: 400 });
}

// The admin can delete anything; everyone else can delete only their own comments.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const found = await load(req, id);
  if (!found) return Response.json({ error: "Not found" }, { status: 404 });
  if (!found.isAdmin && !found.isAuthor) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  await deleteComment(found.comment);
  return Response.json({ ok: true });
}
