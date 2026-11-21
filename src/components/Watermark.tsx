import { WATERMARK_LOGO } from "@/lib/watermark-logo";

// How faint the watermark is (0 = invisible, 1 = solid). Tweak here.
const NAME_OPACITY = 0.085;
const LOGO_OPACITY = 0.06;

const xml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Viewer-specific watermark: a faint, slanted pattern across the whole picture that repeats
 * the viewer's name next to a faded logo. It is one repeating background, sized with
 * container-query units so it scales with the player (including fullscreen).
 */
export default function Watermark({ name }: { name: string }) {
  const logoW = 150;
  const logoH = Math.round((logoW * WATERMARK_LOGO.height) / WATERMARK_LOGO.width);
  const gap = 26;
  const textW = Math.max(120, name.length * 19);
  const contentW = logoW + gap + textW;
  const W = Math.round(contentW + 220); // breathing room between repeats
  const H = 300;
  const x0 = (W - contentW) / 2;
  const cy = H / 2;

  const tile =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}'>` +
    `<g transform='rotate(-25 ${W / 2} ${H / 2})'>` +
    `<image href='data:image/png;base64,${WATERMARK_LOGO.base64}' x='${x0}' y='${cy - logoH / 2}' ` +
    `width='${logoW}' height='${logoH}' opacity='${LOGO_OPACITY}'/>` +
    `<text x='${x0 + logoW + gap}' y='${cy + 10}' font-family='Arial,Helvetica,sans-serif' font-size='30' ` +
    `font-weight='700' fill='white' fill-opacity='${NAME_OPACITY}' stroke='black' stroke-opacity='0.05'>${xml(name)}</text>` +
    `</g></svg>`;

  // Keep the logo the same size on screen (about 11% of the player width) whatever the name length.
  const tileWidthCqw = (W / logoW) * 11;

  return (
    <div
      data-wm
      aria-hidden
      className="pointer-events-none absolute inset-0 select-none overflow-hidden"
      style={{
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(tile)}")`,
        backgroundSize: `${tileWidthCqw}cqw auto`,
        backgroundRepeat: "repeat",
        backgroundPosition: "center",
      }}
    />
  );
}
