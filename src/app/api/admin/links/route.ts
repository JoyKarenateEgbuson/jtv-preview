import { createLink, getVideo } from "@/lib/repo";
import { adminDenied } from "@/lib/session";

export async function POST(req: Request) {
  const denied = await adminDenied();
  if (denied) return denied;
  const b = (await req.json().catch(() => ({}))) as {
    videoId?: string;
    label?: string;
    viewerName?: string;
    expiresInDays?: number;
  };
  if (!b.videoId || !(await getVideo(b.videoId))) {
    return Response.json({ error: "Unknown video" }, { status: 400 });
  }
  const days = Number(b.expiresInDays) || 0;
  const link = await createLink({
    videoId: b.videoId,
    label: (b.label ?? "").trim().slice(0, 80) || "Share link",
    viewerName: (b.viewerName ?? "").trim().slice(0, 80),
    expiresAt: days > 0 ? Math.floor(Date.now() / 1000) + days * 86400 : 0,
  });
  return Response.json(link, { status: 201 });
}
