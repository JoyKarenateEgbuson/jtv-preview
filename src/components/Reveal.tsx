"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Fades and rises into view as you scroll to it: the same motion as thejoietv.com's ScrollReveal
 * (40px, 0.8s, ease-out, triggered when it reaches 85% down the screen). `delay` staggers a row of cards.
 * The look lives in globals.css (.reveal); people who prefer reduced motion simply see everything.
 */
export default function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  /** Milliseconds to wait after becoming visible. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = () => setShown(true);
    if (typeof IntersectionObserver === "undefined") {
      const t = window.setTimeout(show, 0);
      return () => window.clearTimeout(t);
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          show();
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -15% 0px" }, // "top 85%"
    );
    io.observe(el);
    // Safety net: something near the very bottom of a short page would never cross the 85% line.
    const fallback = window.setTimeout(() => {
      if (el.getBoundingClientRect().top < window.innerHeight) show();
    }, 1200);
    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${shown ? "reveal-in" : ""} ${className}`}
      style={shown && delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
