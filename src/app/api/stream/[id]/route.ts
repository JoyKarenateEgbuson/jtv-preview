import type { NextRequest } from "next/server";
import { authorize } from "@/lib/access";
import { openStream } from "@/lib/storage";

// The streaming proxy: checks the viewer's signed token, then relays the requested
// byte range from storage. The original file's location is never revealed.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await authorize(req.nextUrl.searchParams.get("t"));
  if (!auth || auth.video.id !== id) return new Response("Forbidden", { status: 403 });

  const result = await openStream(auth.video, req.headers.get("range"));
  return new Response(result.body, {
    status: result.status,
    headers: {
      ...result.headers,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
