import { adminDenied } from "@/lib/session";
import { initUpload } from "@/lib/storage";

export async function POST(req: Request) {
  const denied = await adminDenied();
  if (denied) return denied;
  const b = (await req.json().catch(() => ({}))) as { name?: string; size?: number; mimeType?: string };
  if (!b.name || !b.size || !b.mimeType?.startsWith("video/")) {
    return Response.json({ error: "Please choose a video file" }, { status: 400 });
  }
  try {
    const init = await initUpload({
      name: b.name,
      size: b.size,
      mimeType: b.mimeType,
      origin: new URL(req.url).origin,
    });
    return Response.json(init);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
