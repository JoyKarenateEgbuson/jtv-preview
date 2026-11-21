import type { NextRequest } from "next/server";
import { openStream } from "@/lib/storage";
import { authorizeStream } from "@/lib/streamauth";

// Used for local-disk dev videos. On Cloudflare, worker.ts answers /api/stream/* for Drive
// videos before Next.js even runs (far cheaper), and this route is the fallback.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await authorizeStream(req.nextUrl.searchParams.get("t"));
  if (!auth || auth.videoId !== id) return new Response("Forbidden", { status: 403 });

  const result = await openStream(
    { storage: auth.storage, fileRef: auth.fileRef, mimeType: auth.mime },
    req.headers.get("range"),
  );
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
