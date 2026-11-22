"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

// The page the visitor was on before this one (null on the very first load).
let lastPath: string | null = null;
const isViewer = (p: string) => /\/v\/[^/]+$/.test(p) || p.startsWith("/admin/videos/");

/**
 * Page transitions like thejoietv.com: a dark panel sweeps up the screen and the new page fades in.
 * Moving between two video pages (e.g. "next episode") skips the sweep so playback isn't delayed,
 * and the first load of the site only fades in. A template remounts on each navigation, which
 * replays the animation; refreshing data or posting a comment does not.
 */
export default function Template({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const mode = lastPath === null ? "fade" : isViewer(lastPath) && isViewer(pathname) ? "quick" : "sweep";

  useEffect(() => {
    lastPath = pathname;
  }, [pathname]);

  return (
    <>
      {mode === "sweep" && <div aria-hidden className="jtv-sweep-panel" />}
      <div className={`page-in-${mode}`}>{children}</div>
    </>
  );
}
