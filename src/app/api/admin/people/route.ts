import { createPerson } from "@/lib/repo";
import { adminDenied } from "@/lib/session";

export async function POST(req: Request) {
  const denied = await adminDenied();
  if (denied) return denied;
  const b = (await req.json().catch(() => ({}))) as { name?: string; kind?: string };
  if (!b.name?.trim() || (b.kind !== "client" && b.kind !== "guest")) {
    return Response.json({ error: "Name and type are required" }, { status: 400 });
  }
  return Response.json(await createPerson(b.name.trim().slice(0, 80), b.kind), { status: 201 });
}
