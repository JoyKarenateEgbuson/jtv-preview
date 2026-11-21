import { adminDenied } from "@/lib/session";
import { isValidLocalRef } from "@/lib/storage";

// Dev-only: receives the upload when Google Drive isn't configured yet.
export async function PUT(req: Request, ctx: { params: Promise<{ ref: string }> }) {
  const denied = await adminDenied();
  if (denied) return denied;
  const { ref } = await ctx.params;
  if (!isValidLocalRef(ref) || !req.body) return Response.json({ error: "Bad request" }, { status: 400 });
  // Loaded lazily so the Cloudflare Worker bundle never touches the filesystem.
  const { saveLocalUpload } = await import("@/lib/storage-local");
  await saveLocalUpload(ref, req.body);
  return Response.json({ id: ref });
}
