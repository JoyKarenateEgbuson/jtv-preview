const pad = (n: number) => String(n).padStart(2, "0");

/** Frame-accurate timecode: MM:SS:FF (or H:MM:SS:FF for long videos). */
export function formatTc(seconds: number, fps: number): string {
  const t = Math.max(0, seconds);
  const f = Math.min(Math.max(1, Math.round(fps)) - 1, Math.floor((t % 1) * fps + 1e-6));
  const s = Math.floor(t) % 60;
  const m = Math.floor(t / 60) % 60;
  const h = Math.floor(t / 3600);
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}:${pad(f)}` : `${pad(m)}:${pad(s)}:${pad(f)}`;
}

/** Short clock for the seek bar: M:SS or H:MM:SS. */
export function formatClock(seconds: number): string {
  const t = Math.max(0, Math.floor(seconds));
  const s = t % 60;
  const m = Math.floor(t / 60) % 60;
  const h = Math.floor(t / 3600);
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** True when a share link's expiry (unix seconds, 0 = never) has passed. */
export const isExpired = (expiresAt: number) => expiresAt > 0 && expiresAt < Date.now() / 1000;

/** Snap a time to the nearest frame boundary. */
export const snapToFrame = (t: number, fps: number) => Math.round(t * fps) / fps;
