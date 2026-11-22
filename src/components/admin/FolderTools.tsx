"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** On a folder page: add a subfolder, and set watermark / download for every video inside at once. */
export default function FolderTools({ folderId, videoCount }: { folderId: string; videoCount: number }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [watermark, setWatermark] = useState<"keep" | "on" | "off">("keep");
  const [download, setDownload] = useState<"keep" | "on" | "off">("keep");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function addFolder() {
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/admin/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId: folderId }),
    });
    setBusy(false);
    if (res.ok) {
      setName("");
      setAdding(false);
      router.refresh();
    } else {
      setMsg(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not create folder");
    }
  }

  async function apply() {
    const applyToVideos: Record<string, boolean> = {};
    if (watermark !== "keep") applyToVideos.watermark = watermark === "on";
    if (download !== "keep") applyToVideos.allowDownload = download === "on";
    if (!Object.keys(applyToVideos).length) return setMsg("Choose a setting to change first.");
    setBusy(true);
    const res = await fetch(`/api/admin/folders/${folderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applyToVideos }),
    });
    setBusy(false);
    if (res.ok) {
      const { updatedVideos } = (await res.json()) as { updatedVideos: number };
      setMsg(`Updated ${updatedVideos} video${updatedVideos === 1 ? "" : "s"}.`);
      setWatermark("keep");
      setDownload("keep");
      router.refresh();
    } else {
      setMsg("Could not update.");
    }
  }

  const sel = (v: string, set: (x: "keep" | "on" | "off") => void) => (
    <select className="field !w-auto" value={v} onChange={(e) => set(e.target.value as "keep" | "on" | "off")}>
      <option value="keep">Leave as is</option>
      <option value="on">Turn on</option>
      <option value="off">Turn off</option>
    </select>
  );

  return (
    <div className="card space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {adding ? (
          <>
            <input className="field !w-64" autoFocus placeholder="Subfolder name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addFolder()} />
            <button type="button" className="btn" disabled={busy || !name.trim()} onClick={addFolder}>Create</button>
            <button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
          </>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={() => setAdding(true)}>+ New subfolder</button>
        )}
      </div>

      {videoCount > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold">Settings for all {videoCount} video{videoCount === 1 ? "" : "s"} in this folder</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <label className="flex items-center gap-2">Watermark {sel(watermark, setWatermark)}</label>
            <label className="flex items-center gap-2">Downloads (clients only) {sel(download, setDownload)}</label>
            <button type="button" className="btn" disabled={busy} onClick={apply}>Apply</button>
          </div>
        </div>
      )}
      {msg && <p className="text-xs text-cream/70">{msg}</p>}
    </div>
  );
}
