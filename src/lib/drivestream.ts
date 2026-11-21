import { driveToken } from "./google";
import { capRange } from "./range";

// Shared by the Next.js route and the Cloudflare front-door Worker (worker.ts).
// Keep this file free of Node-only imports.
const DRIVE = "https://www.googleapis.com/drive/v3";
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/** Fetch bytes of a Drive file for one Range request, retrying if Google briefly says no. */
export async function fetchDriveMedia(fileRef: string, rangeHeader: string | null): Promise<Response> {
  const range = capRange(rangeHeader);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${DRIVE}/files/${encodeURIComponent(fileRef)}?alt=media`, {
      headers: {
        Authorization: `Bearer ${await driveToken()}`,
        "Accept-Encoding": "identity",
        ...(range ? { Range: range } : {}),
      },
    });
    if (!RETRYABLE.has(res.status) || attempt >= 2) return res;
    await res.body?.cancel();
    await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
  }
}

/** Response headers for streamed video, copying only what the browser needs from Drive's reply. */
export function mediaHeaders(upstream: Response, mime: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
  };
  for (const h of ["content-length", "content-range"]) {
    const v = upstream.headers.get(h);
    if (v) headers[h] = v;
  }
  return headers;
}
