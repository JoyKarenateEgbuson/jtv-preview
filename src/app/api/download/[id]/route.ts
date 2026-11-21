import type { NextRequest } from "next/server";
import { authorize } from "@/lib/access";
import { openStream } from "@/lib/storage";

// Only works when the viewer is allowed to download (admin, or a client on a video
// with downloads on). Guests and share links are always refused.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await authorize(req.nextUrl.searchParams.get("t"));
  if (!auth || auth.video.id !== id) return new Response("Forbidden", { status: 403 });
  if (!auth.perms.download) return new Response("Downloads are turned off", { status: 403 });

  const result = await openStream(auth.video, null);
  const ext = auth.video.mimeType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "mp4";
  const filename = `${auth.video.title.replace(/[^\w\- ]+/g, "")} v${auth.video.version}.${ext}`;
  return new Response(result.body, {
    status: result.status,
    headers: {
      ...result.headers,
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
