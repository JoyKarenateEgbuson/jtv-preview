import { randomToken } from "@/lib/crypto";
import { deletePerson, getPerson, updatePerson } from "@/lib/repo";
import { adminDenied } from "@/lib/session";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await adminDenied();
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!(await getPerson(id))) return Response.json({ error: "Not found" }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as {
    name?: string;
    kind?: string;
    regenerateLink?: boolean;
  };
  const patch: { name?: string; kind?: "client" | "guest"; token?: string } = {};
  if (b.name?.trim()) patch.name = b.name.trim().slice(0, 80);
  if (b.kind === "client" || b.kind === "guest") patch.kind = b.kind;
  // Regenerating invalidates the old private page URL.
  if (b.regenerateLink) patch.token = randomToken();
  await updatePerson(id, patch);
  return Response.json(await getPerson(id));
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await adminDenied();
  if (denied) return denied;
  const { id } = await ctx.params;
  await deletePerson(id);
  return Response.json({ ok: true });
}
