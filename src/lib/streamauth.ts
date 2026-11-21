import { readToken } from "./crypto";
import type { ViewerToken } from "./access";

/**
 * Checks a viewer token for the video stream WITHOUT touching the database: the token is
 * signed by the server and already carries the file reference. That keeps each of the many
 * small range requests a player makes cheap and fast.
 */
export async function authorizeStream(token: string | null) {
  const t = await readToken<ViewerToken>(token);
  if (!t || !t.f || !t.m || !t.s) return null;
  return { videoId: t.v, fileRef: t.f, mime: t.m, storage: t.s };
}
