"use client";

import { useEffect, type ReactNode } from "react";

/** A simple centred dialog. Closes on Escape or a click on the dark backdrop. */
export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="card max-h-[90vh] w-full max-w-md overflow-y-auto p-5">
        <div className="mb-4 flex items-start gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto text-cream/60 hover:text-cream">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
