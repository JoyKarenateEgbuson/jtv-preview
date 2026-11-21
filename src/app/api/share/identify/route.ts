import { cookies } from "next/headers";
import { getLinkByToken } from "@/lib/repo";

// A share-link viewer tells us their name once; it goes on the watermark and their comments.
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { token?: string; name?: string };
  const name = (b.name ?? "").trim().slice(0, 60);
  const link = b.token ? await getLinkByToken(b.token) : null;
  if (!link || !name) return Response.json({ error: "Please enter your name" }, { status: 400 });
  (await cookies()).set(`jtv_name_${link.id}`, name, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return Response.json({ ok: true });
}
