// Swap public/logo.png (white, transparent) for a new logo and this updates everywhere (including the watermark).
export const LOGO_SRC = "/logo.png";

export default function Logo({ height = 28 }: { height?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={LOGO_SRC} alt="The Joie TV" style={{ height }} className="w-auto select-none" draggable={false} />;
}
