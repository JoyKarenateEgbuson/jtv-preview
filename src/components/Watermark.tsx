import { LOGO_SRC } from "./Logo";

const xml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Viewer-specific watermark: a faint diagonal tile of the viewer's name across the
 * whole frame, plus a drifting badge with the logo and name. Sized with container
 * query units so it scales with the player, including in fullscreen.
 */
export default function Watermark({ name }: { name: string }) {
  const tile =
    `<svg xmlns='http://www.w3.org/2000/svg' width='360' height='220'>` +
    `<text x='24' y='125' transform='rotate(-25 180 110)' font-family='Arial,sans-serif' font-size='20' ` +
    `font-weight='700' fill='white' fill-opacity='0.11' stroke='black' stroke-opacity='0.07'>${xml(name)}</text></svg>`;

  // Deterministic start offset per viewer, so each person's badge begins somewhere different.
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 70;

  return (
    <div
      data-wm
      aria-hidden
      className="pointer-events-none absolute inset-0 select-none overflow-hidden"
      style={{ backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(tile)}")` }}
    >
      <div
        className="wm-badge flex items-center gap-[1.2cqw] rounded-full bg-black/35 px-[1.6cqw] py-[0.7cqw]"
        style={{ animationDelay: `-${hash}s`, opacity: 0.85 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_SRC} alt="" draggable={false} style={{ height: "clamp(20px, 5cqw, 56px)" }} />
        <span
          className="font-semibold text-white"
          style={{ fontSize: "clamp(10px, 2cqw, 22px)", textShadow: "0 1px 3px rgba(0,0,0,.7)" }}
        >
          {name}
        </span>
      </div>
    </div>
  );
}
