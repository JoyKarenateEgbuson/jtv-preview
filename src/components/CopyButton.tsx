"use client";

import { useState } from "react";

/** Copies the full URL for a site path (works on any domain, incl. preview.thejoietv.com). */
export default function CopyButton({ path, label = "Copy link" }: { path: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={async () => {
        await navigator.clipboard.writeText(`${window.location.origin}${path}`);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}
