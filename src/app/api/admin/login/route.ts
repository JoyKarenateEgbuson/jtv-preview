import { cookies } from "next/headers";
import { adminPassword } from "@/lib/config";
import { safeEqual } from "@/lib/crypto";
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, createAdminSession } from "@/lib/session";

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!password || !(await safeEqual(password, adminPassword()))) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return Response.json({ error: "Wrong password" }, { status: 401 });
  }
  (await cookies()).set(ADMIN_COOKIE, await createAdminSession(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_SECONDS,
  });
  return Response.json({ ok: true });
}
