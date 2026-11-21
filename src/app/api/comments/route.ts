import type { NextRequest } from "next/server";
import { authorize } from "@/lib/access";
import { createComment, getComment, listComments } from "@/lib/repo";
import { snapToFrame } from "@/lib/time";

export async function GET(req: NextRequest) {
  const auth = await authorize(req.nextUrl.searchParams.get("t"));
  if (!auth) return Response.json({ error: "Forbidden" }, { status: 403 });
  const all = await listComments(auth.video.id);
  // Internal comments never leave the server for non-admins.
  return Response.json(auth.perms.internal ? all : all.filter((c) => !c.internal));
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    t?: string;
    time?: number;
    timeEnd?: number | null;
    text?: string;
    parentId?: string | null;
    internal?: boolean;
  } | null;
  const auth = await authorize(body?.t ?? null);
  if (!auth || !body) return Response.json({ error: "Forbidden" }, { status: 403 });

  const text = (body.text ?? "").trim();
  if (!text || text.length > 2000) {
    return Response.json({ error: "Comment must be 1–2000 characters" }, { status: 400 });
  }
  const fps = auth.video.fps;
  const time = Number(body.time);
  if (!Number.isFinite(time) || time < 0) {
    return Response.json({ error: "Invalid time" }, { status: 400 });
  }
  const timeEnd =
    body.timeEnd != null && Number.isFinite(Number(body.timeEnd)) && Number(body.timeEnd) > time
      ? snapToFrame(Number(body.timeEnd), fps)
      : null;

  let internal = Boolean(body.internal) && auth.perms.internal;
  let parentId: string | null = null;
  if (body.parentId) {
    const parent = await getComment(body.parentId);
    if (!parent || parent.videoId !== auth.video.id || parent.internal && !auth.perms.internal) {
      return Response.json({ error: "Parent comment not found" }, { status: 400 });
    }
    parentId = parent.id;
    internal = parent.internal; // replies inherit privacy
  }

  const comment = await createComment({
    videoId: auth.video.id,
    author: auth.viewer.name,
    role: auth.viewer.role,
    time: snapToFrame(time, fps),
    timeEnd,
    text,
    internal,
    parentId,
  });
  return Response.json(comment, { status: 201 });
}
