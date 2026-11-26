"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import CopyButton from "../CopyButton";
import Modal from "../Modal";

type Props = {
  folder: { id: string; name: string; personIds: string[] };
  people: { id: string; name: string; kind: "client" | "guest" }[];
  counts: { videos: number; folders: number };
  /** Where to go after the folder is deleted. */
  afterDelete: string;
  /** Show the "⋮" button always (on a folder page) instead of only on card hover. */
  alwaysVisible?: boolean;
};

type Dialog = null | "rename" | "share" | "link" | "delete";

/** The "⋮" menu on a folder: rename, share with clients, create a share link, delete. */
export default function FolderMenu({ folder, people, counts, afterDelete, alwaysVisible }: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // rename
  const [name, setName] = useState(folder.name);
  // share with clients
  const [picked, setPicked] = useState<string[]>(folder.personIds);
  // share link
  const [label, setLabel] = useState("");
  const [viewerName, setViewerName] = useState("");
  const [days, setDays] = useState("7");
  const [made, setMade] = useState<{ token: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function openDialog(d: Exclude<Dialog, null>) {
    setOpen(false);
    setError("");
    setBusy(false);
    setName(folder.name);
    setPicked(folder.personIds);
    setMade(null);
    setDialog(d);
  }

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    setError("");
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
    setBusy(false);
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Something went wrong");
      return null;
    }
    return res.json();
  }

  async function saveRename() {
    if (await call(`/api/admin/folders/${folder.id}`, { method: "PATCH", body: JSON.stringify({ name }) })) {
      setDialog(null);
      router.refresh();
    }
  }

  async function saveShare() {
    if (await call(`/api/admin/folders/${folder.id}`, { method: "PATCH", body: JSON.stringify({ personIds: picked }) })) {
      setDialog(null);
      router.refresh();
    }
  }

  async function makeLink() {
    const link = await call("/api/admin/links", {
      method: "POST",
      body: JSON.stringify({ folderId: folder.id, label, viewerName, expiresInDays: Number(days) }),
    });
    if (link) {
      setMade({ token: (link as { token: string }).token });
      router.refresh();
    }
  }

  async function remove() {
    if (await call(`/api/admin/folders/${folder.id}`, { method: "DELETE" })) {
      setDialog(null);
      router.push(afterDelete);
      router.refresh();
    }
  }

  const items: { label: string; run: () => void; danger?: boolean }[] = [
    { label: "Rename", run: () => openDialog("rename") },
    { label: "Share with clients…", run: () => openDialog("share") },
    { label: "Create share link…", run: () => openDialog("link") },
    { label: "Delete folder…", run: () => openDialog("delete"), danger: true },
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={`Options for folder ${folder.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`grid h-8 w-8 place-items-center rounded-full bg-black/60 text-cream hover:bg-black/80 ${
          alwaysVisible ? "" : "sm:opacity-0 sm:transition sm:group-hover:opacity-100 sm:focus:opacity-100"
        } ${open ? "sm:!opacity-100" : ""}`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
          <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-xl border border-line bg-panel py-1 shadow-xl">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={it.run}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-white/10 ${it.danger ? "text-red-400" : ""}`}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}

      {dialog === "rename" && (
        <Modal title="Rename folder" onClose={() => setDialog(null)}>
          <input className="field" value={name} maxLength={120} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && name.trim() && saveRename()} />
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setDialog(null)}>Cancel</button>
            <button type="button" className="btn" disabled={busy || !name.trim()} onClick={saveRename}>Save</button>
          </div>
        </Modal>
      )}

      {dialog === "share" && (
        <Modal title={`Share “${folder.name}” with clients`} onClose={() => setDialog(null)}>
          <p className="mb-3 text-sm text-cream/70">
            Everything inside this folder, including subfolders and new videos added later, appears on the client&apos;s page.
          </p>
          {people.length === 0 ? (
            <p className="text-sm text-stone">No clients yet. Add one under Clients first.</p>
          ) : (
            <div data-lenis-prevent className="max-h-64 space-y-1.5 overflow-y-auto">
              {people.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={picked.includes(p.id)}
                    onChange={() => setPicked((cur) => (cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id]))}
                  />
                  {p.name}
                  {p.kind === "guest" && <span className="rounded-lg bg-line px-1.5 text-[10px]">guest</span>}
                </label>
              ))}
            </div>
          )}
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setDialog(null)}>Cancel</button>
            <button type="button" className="btn" disabled={busy} onClick={saveShare}>Save</button>
          </div>
        </Modal>
      )}

      {dialog === "link" && (
        <Modal title={`Share link for “${folder.name}”`} onClose={() => setDialog(null)}>
          {made ? (
            <div className="space-y-3">
              <p className="text-sm text-cream/70">Link created. Anyone with it can browse and review this whole folder.</p>
              <input className="field font-mono text-xs" readOnly value={`${typeof window !== "undefined" ? window.location.origin : ""}/s/${made.token}`} onFocus={(e) => e.currentTarget.select()} />
              <div className="flex justify-end gap-2">
                <CopyButton path={`/s/${made.token}`} />
                <button type="button" className="btn" onClick={() => setDialog(null)}>Done</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <input className="field" placeholder="Label (e.g. Sent to LLA)" value={label} onChange={(e) => setLabel(e.target.value)} />
              <div>
                <input className="field" placeholder="Name on the video (optional)" value={viewerName} onChange={(e) => setViewerName(e.target.value)} />
                <p className="mt-1 text-xs text-stone">
                  Sending to a group (a company)? <b>Leave this empty</b>, so each person types their own name the first
                  time. Their name goes on the watermark and on their comments, and they can change it later.
                </p>
              </div>
              <select className="field" value={days} onChange={(e) => setDays(e.target.value)}>
                <option value="1">Expires in 1 day</option>
                <option value="7">Expires in 7 days</option>
                <option value="30">Expires in 30 days</option>
                <option value="0">Never expires</option>
              </select>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-ghost" onClick={() => setDialog(null)}>Cancel</button>
                <button type="button" className="btn" disabled={busy} onClick={makeLink}>Create link</button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {dialog === "delete" && (
        <Modal title="Delete this folder?" onClose={() => setDialog(null)}>
          <p className="text-sm text-cream/80">
            This permanently deletes <b>“{folder.name}”</b> and everything inside it:{" "}
            <b>{counts.videos} video{counts.videos === 1 ? "" : "s"}</b>
            {counts.folders > 0 && <> and <b>{counts.folders} subfolder{counts.folders === 1 ? "" : "s"}</b></>}, including the
            files in Google Drive, all comments and every share link. <b>This cannot be undone.</b>
          </p>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setDialog(null)}>Cancel</button>
            <button type="button" className="btn btn-danger" disabled={busy} onClick={remove}>
              {busy ? "Deleting…" : "Delete everything"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
