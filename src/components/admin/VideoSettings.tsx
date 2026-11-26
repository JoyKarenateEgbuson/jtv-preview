"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Person, Video } from "@/lib/types";

export default function VideoSettings({ video, people }: { video: Video; people: Person[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(video.title);
  const [fps, setFps] = useState(String(video.fps));
  const [watermark, setWatermark] = useState(video.watermark);
  const [allowDownload, setAllowDownload] = useState(video.allowDownload);
  const [personIds, setPersonIds] = useState(video.personIds);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

  async function save() {
    setState("saving");
    await fetch(`/api/admin/videos/${video.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, fps: Number(fps), watermark, allowDownload, personIds }),
    });
    setState("saved");
    router.refresh();
    setTimeout(() => setState("idle"), 1500);
  }

  async function remove() {
    if (!confirm(`Delete "${video.title}" v${video.version}, its file, links and comments? This cannot be undone.`)) return;
    await fetch(`/api/admin/videos/${video.id}`, { method: "DELETE" });
    router.push("/admin");
    router.refresh();
  }

  const toggle = (id: string) =>
    setPersonIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <div className="card space-y-4 p-5">
      <h2 className="font-semibold">Settings · v{video.version}</h2>

      <label className="block text-sm">
        <span className="mb-1 block text-cream/70">Title</span>
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-cream/70">Frame rate (for timecodes)</span>
        <select className="field" value={fps} onChange={(e) => setFps(e.target.value)}>
          {[23.976, 24, 25, 29.97, 30, 50, 59.94, 60].map((f) => (
            <option key={f} value={f}>{f} fps</option>
          ))}
        </select>
      </label>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1" checked={watermark} onChange={(e) => setWatermark(e.target.checked)} />
        <span>
          <b>Watermark with viewer&apos;s name + logo</b>
          <span className="block text-xs text-stone">Guests and share links always get it, whatever this says.</span>
        </span>
      </label>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1" checked={allowDownload} onChange={(e) => setAllowDownload(e.target.checked)} />
        <span>
          <b>Allow downloads (clients only)</b>
          <span className="block text-xs text-stone">Guests and share links can never download.</span>
        </span>
      </label>

      <div className="text-sm">
        <span className="mb-1 block text-cream/70">Shared with</span>
        {people.length === 0 ? (
          <p className="text-xs text-stone">No clients yet. Add one under Clients.</p>
        ) : (
          <div className="space-y-1">
            {people.map((p) => (
              <label key={p.id} className="flex items-center gap-2">
                <input type="checkbox" checked={personIds.includes(p.id)} onChange={() => toggle(p.id)} />
                {p.name}
                {p.kind === "guest" && <span className="rounded-lg bg-line px-1.5 text-[10px]">guest</span>}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button type="button" className="btn" onClick={save} disabled={state === "saving"}>
          {state === "saved" ? "Saved ✓" : state === "saving" ? "Saving…" : "Save changes"}
        </button>
        <button type="button" className="btn btn-danger ml-auto" onClick={remove}>Delete</button>
      </div>
    </div>
  );
}
