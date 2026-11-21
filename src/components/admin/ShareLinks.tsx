"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isExpired } from "@/lib/time";
import type { ShareLink } from "@/lib/types";
import CopyButton from "../CopyButton";

export default function ShareLinks({ videoId, links }: { videoId: string; links: ShareLink[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [viewerName, setViewerName] = useState("");
  const [days, setDays] = useState("7");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    await fetch("/api/admin/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, label, viewerName, expiresInDays: Number(days) }),
    });
    setBusy(false);
    setLabel("");
    setViewerName("");
    router.refresh();
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this link? Anyone using it will lose access immediately.")) return;
    await fetch(`/api/admin/links/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="card space-y-4 p-5">
      <h2 className="font-semibold">Share links</h2>
      <p className="text-xs text-stone">
        For people who aren&apos;t clients. Always watermarked, never downloadable. Leave the name blank and the viewer is asked for theirs.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <input className="field" placeholder="Label (e.g. Sent to Ada)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input className="field" placeholder="Viewer name (optional)" value={viewerName} onChange={(e) => setViewerName(e.target.value)} />
        <select className="field" value={days} onChange={(e) => setDays(e.target.value)}>
          <option value="1">Expires in 1 day</option>
          <option value="7">Expires in 7 days</option>
          <option value="30">Expires in 30 days</option>
          <option value="0">Never expires</option>
        </select>
        <button type="button" className="btn" disabled={busy} onClick={create}>Create link</button>
      </div>

      <ul className="space-y-2">
        {links.length === 0 && <li className="text-sm text-stone">No links yet.</li>}
        {links.map((l) => {
          const expired = isExpired(l.expiresAt);
          return (
            <li key={l.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{l.label}{l.viewerName && ` · ${l.viewerName}`}</p>
                <p className="text-xs text-stone">
                  {expired
                    ? "Expired"
                    : l.expiresAt
                      ? `Expires ${new Date(l.expiresAt * 1000).toLocaleDateString()}`
                      : "Never expires"}
                </p>
              </div>
              <CopyButton path={`/s/${l.token}`} />
              <button type="button" className="btn btn-danger" onClick={() => revoke(l.id)}>Revoke</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
