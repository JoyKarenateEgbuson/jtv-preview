"use client";

import Lenis from "lenis";
import { useEffect } from "react";

declare global {
  interface Window {
    /** Lets dialogs pause smooth scrolling while they are open. */
    __jtvLenis?: Lenis | null;
  }
}

/**
 * Smooth, gliding page scroll, tuned exactly like thejoietv.com (lerp 0.08, 1.2s, expo ease-out).
 * Anything marked data-lenis-prevent (the comments list, dialogs) keeps its own normal scrolling.
 * People who prefer reduced motion get plain browser scrolling.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      lerp: 0.08,
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });
    window.__jtvLenis = lenis;

    let raf = 0;
    const tick = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      window.__jtvLenis = null;
    };
  }, []);

  return null;
}
