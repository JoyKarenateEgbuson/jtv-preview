import { storageMode } from "@/lib/config";
import { createVideo, getVideo } from "@/lib/repo";
import { adminDenied } from "@/lib/session";

// Registers an uploaded file as a video (optionally as a new version of an existing one).
export async function POST(req: Request) {
  const denied = await adminDenied();
  if (denied) return denied;
  const b = (await req.json().catch(() => ({}))) as {
    title?: string;
    fileRef?: string;
    mimeType?: string;
    size?: number;
    stackId?: string;
  };
  if (!b.title?.trim() || !b.fileRef || !b.mimeType || !b.size) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }
  if (b.stackId && !(await getVideo(b.stackId)) ) {
    // stackId is the id of the first version, so it must exist.
    return Response.json({ error: "Unknown video stack" }, { status: 400 });
  }
  const video = await createVideo({
    title: b.title.trim().slice(0, 120),
    storage: storageMode(),
    fileRef: b.fileRef,
    mimeType: b.mimeType,
    size: b.size,
    stackId: b.stackId,
  });
  return Response.json(video, { status: 201 });
}
