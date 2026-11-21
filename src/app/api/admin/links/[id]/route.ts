import { deleteLink } from "@/lib/repo";
import { adminDenied } from "@/lib/session";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await adminDenied();
  if (denied) return denied;
  const { id } = await ctx.params;
  await deleteLink(id);
  return Response.json({ ok: true });
}
