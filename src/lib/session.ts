import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readToken, signToken } from "./crypto";

export const ADMIN_COOKIE = "jtv_admin";
export const ADMIN_SESSION_SECONDS = 7 * 24 * 60 * 60;

export async function createAdminSession(): Promise<string> {
  return signToken({ r: "admin", e: Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS });
}

export async function isAdmin(): Promise<boolean> {
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  const payload = await readToken<{ r: string; e: number }>(value);
  return payload?.r === "admin";
}

/**
 * For admin pages: call at the top of EVERY admin page. Next.js can render a page
 * without its layout, so the layout check alone is not enough.
 */
export async function requireAdminPage(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

/** For route handlers: returns a 401 Response when not signed in as admin, else null. */
export async function adminDenied(): Promise<Response | null> {
  return (await isAdmin()) ? null : Response.json({ error: "Unauthorized" }, { status: 401 });
}
