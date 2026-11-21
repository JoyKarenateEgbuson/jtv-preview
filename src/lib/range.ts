/** Largest slice of a video one request may return. Browsers simply ask for the next slice. */
export const MAX_CHUNK = 16 * 1024 * 1024;

/**
 * Bound a client's Range header so one request never drags the whole rest of a big file
 * through the server. This matters when someone scrubs: each abandoned seek is cheap.
 */
export function capRange(header: string | null): string | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return header; // unusual form: let the upstream decide
  const [, a, b] = m;
  if (a === "") return header; // suffix range ("the last 2 KB"): already small
  const start = parseInt(a, 10);
  const end = b === "" ? Infinity : parseInt(b, 10);
  return `bytes=${start}-${Math.min(end, start + MAX_CHUNK - 1)}`;
}
