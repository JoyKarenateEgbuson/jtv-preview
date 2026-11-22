import { cookies } from "next/headers";
import { getLinkByToken } from "./repo";
import { isExpired } from "./time";
import type { ShareLink } from "./types";

export type ShareGate =
  | { state: "missing" }
  | { state: "expired" }
  | { state: "needname"; link: ShareLink }
  | { state: "ok"; link: ShareLink; name: string };

/**
 * Checks a share link and works out who is looking. The name the viewer typed (a cookie, per link)
 * wins over a fixed name set on the link, so each person in a group can use their own.
 */
export async function shareGate(token: string): Promise<ShareGate> {
  const link = await getLinkByToken(token);
  if (!link) return { state: "missing" };
  if (isExpired(link.expiresAt)) return { state: "expired" };
  const name = (await cookies()).get(`jtv_name_${link.id}`)?.value || link.viewerName;
  return name ? { state: "ok", link, name } : { state: "needname", link };
}
