import { readToken, signToken } from "./crypto";
import { getVideo } from "./repo";
import type { Role, Video } from "./types";

export type Viewer = { role: Role; name: string };

/** What a viewer may do with a video. Guests/share links are always locked down. */
export function permsFor(role: Role, video: Video) {
  return {
    watermark: role === "guest" || video.watermark,
    download: role === "admin" || (role === "client" && video.allowDownload),
    comment: true,
    internal: role === "admin",
  };
}

const TOKEN_SECONDS = 12 * 60 * 60;

export type ViewerToken = { v: string; r: Role; n: string; e: number };

/** Signed pass for one video, embedded in the stream/comment URLs of the watch page. */
export function mintViewerToken(videoId: string, viewer: Viewer): Promise<string> {
  const payload: ViewerToken = {
    v: videoId,
    r: viewer.role,
    n: viewer.name,
    e: Math.floor(Date.now() / 1000) + TOKEN_SECONDS,
  };
  return signToken(payload);
}

export async function authorize(token: string | null) {
  const t = await readToken<ViewerToken>(token);
  if (!t) return null;
  const video = await getVideo(t.v);
  if (!video) return null;
  return { video, viewer: { role: t.r, name: t.n } as Viewer, perms: permsFor(t.r, video) };
}
