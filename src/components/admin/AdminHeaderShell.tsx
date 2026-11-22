"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * The admin header. On a video page the comments panel runs down the right edge of the window
 * (full height), so the header leaves that strip free instead of sitting underneath it.
 */
export default function AdminHeaderShell({ children }: { children: ReactNode }) {
  const onVideo = usePathname().startsWith("/admin/videos/");
  return <header className={`border-b border-line ${onVideo ? "lg:pr-[380px]" : ""}`}>{children}</header>;
}
