"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatTc, snapToFrame } from "@/lib/time";
import type { Comment, Role } from "@/lib/types";
import VideoPlayer, { type PlayerHandle } from "./VideoPlayer";

type Props = {
  /** Signed viewer token for this video (goes in API URLs). */
  token: string;
  videoId: string;
  title: string;
  fps: number;
  viewerName: string;
  role: Role;
  watermarkName: string | null;
  canDownload: boolean;
  versions: { id: string; label: string; href: string }[];
};

type Filter = "all" | "open" | "resolved";

export default function ReviewRoom(p: Props) {
  const playerRef = useRef<PlayerHandle>(null);
  const timeRef = useRef(0);
  const [time, setTime] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(false);
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const src = `/api/stream/${p.videoId}?t=${encodeURIComponent(p.token)}`;
  const isAdmin = p.role === "admin";

  const load = useCallback(async () => {
    const res = await fetch(`/api/comments?t=${encodeURIComponent(p.token)}`, { cache: "no-store" });
    if (res.ok) setComments((await res.json()) as Comment[]);
  }, [p.token]);

  useEffect(() => {
    // Initial load, then poll so new feedback shows up without a refresh.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const id = window.setInterval(load, 8000);
    return () => window.clearInterval(id);
  }, [load]);

  const onTime = useCallback((t: number) => {
    timeRef.current = t;
    setTime(t);
  }, []);

  const top = useMemo(() => comments.filter((c) => !c.parentId), [comments]);
  const shown = useMemo(
    () =>
      top.filter((c) => (filter === "all" ? true : filter === "open" ? !c.resolved : c.resolved)),
    [top, filter],
  );
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);
  const markers = useMemo(
    () => top.map((c) => ({ id: c.id, time: c.time, timeEnd: c.timeEnd, resolved: c.resolved })),
    [top],
  );

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ t: p.token, ...body }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not post");
      return false;
    }
    await load();
    return true;
  }

  async function addComment() {
    const start = rangeStart ?? snapToFrame(timeRef.current, p.fps);
    const ok = await post({ time: start, timeEnd: rangeEnd, text, internal });
    if (ok) {
      setText("");
      setRangeEnd(null);
      setRangeStart(null);
    }
  }

  async function addReply(parentId: string) {
    const parent = comments.find((c) => c.id === parentId);
    const ok = await post({ time: parent?.time ?? 0, text: replyText, parentId });
    if (ok) {
      setReplyText("");
      setReplyTo(null);
    }
  }

  async function toggleResolved(c: Comment) {
    await fetch(`/api/comments/${c.id}?t=${encodeURIComponent(p.token)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: !c.resolved }),
    });
    await load();
  }

  async function remove(c: Comment) {
    if (!confirm("Delete this comment?")) return;
    await fetch(`/api/comments/${c.id}?t=${encodeURIComponent(p.token)}`, { method: "DELETE" });
    await load();
  }

  function exportCsv() {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = [["Timecode", "End", "Author", "Comment", "Status", "Internal", "Reply to"].join(",")];
    for (const c of comments) {
      const parent = c.parentId ? comments.find((x) => x.id === c.parentId) : null;
      rows.push(
        [
          formatTc(c.time, p.fps),
          c.timeEnd != null ? formatTc(c.timeEnd, p.fps) : "",
          esc(c.author),
          esc(c.text),
          c.resolved ? "Resolved" : "Open",
          c.internal ? "Yes" : "",
          parent ? esc(parent.author) : "",
        ].join(","),
      );
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${p.title} - comments.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const startLabel = formatTc(rangeStart ?? time, p.fps);
  const openCount = top.filter((c) => !c.resolved).length;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        <VideoPlayer
          ref={playerRef}
          src={src}
          fps={p.fps}
          watermarkName={p.watermarkName}
          markers={markers}
          rangePreview={rangeStart != null || rangeEnd != null ? { start: rangeStart ?? time, end: rangeEnd } : null}
          onTime={onTime}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold">{p.title}</h1>
          {p.versions.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {p.versions.map((v) => (
                <Link
                  key={v.id}
                  href={v.href}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    v.id === p.videoId ? "bg-brand text-ink" : "border border-line text-cream/70 hover:bg-panel"
                  }`}
                >
                  {v.label}
                </Link>
              ))}
            </div>
          )}
          {p.canDownload && (
            <a className="btn btn-ghost ml-auto" href={`/api/download/${p.videoId}?t=${encodeURIComponent(p.token)}`}>
              Download
            </a>
          )}
        </div>
        <p className="mt-1 text-xs text-stone">
          Space play/pause · ← → step one frame · Shift+← → jump 5s · F fullscreen
        </p>
      </div>

      <aside className="card flex max-h-[80vh] min-h-[420px] flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <h2 className="font-semibold">
            Comments <span className="text-stone">· {openCount} open</span>
          </h2>
          <button type="button" onClick={exportCsv} className="ml-auto text-xs text-cream/60 underline hover:text-cream">
            Export CSV
          </button>
        </div>

        <div className="flex gap-1 border-b border-line px-4 py-2 text-xs">
          {(["all", "open", "resolved"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 capitalize ${filter === f ? "bg-cream text-ink" : "text-cream/60 hover:bg-white/5"}`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {shown.length === 0 && (
            <p className="py-8 text-center text-sm text-stone">
              {top.length === 0 ? "No comments yet. Pause the video and add the first one." : "Nothing in this filter."}
            </p>
          )}
          {shown.map((c) => (
            <div key={c.id} className={`rounded-lg border p-3 ${c.internal ? "border-magenta/60 bg-magenta/10" : "border-line bg-ink/40"} ${c.resolved ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    playerRef.current?.pause();
                    playerRef.current?.seek(c.time);
                  }}
                  className="rounded bg-sun px-1.5 py-0.5 font-mono font-bold text-ink hover:brightness-110"
                  title="Jump to this moment"
                >
                  {formatTc(c.time, p.fps)}
                  {c.timeEnd != null && ` → ${formatTc(c.timeEnd, p.fps)}`}
                </button>
                <span className="font-semibold">{c.author}</span>
                {c.role === "admin" && <span className="rounded bg-brand px-1.5 text-[10px] font-bold text-ink">TEAM</span>}
                {c.internal && <span className="rounded bg-magenta px-1.5 text-[10px] font-bold">INTERNAL</span>}
                <span className="ml-auto text-stone">{new Date(c.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{c.text}</p>

              {repliesOf(c.id).map((r) => (
                <div key={r.id} className="mt-2 border-l-2 border-line pl-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold">{r.author}</span>
                    {r.role === "admin" && <span className="rounded bg-brand px-1.5 text-[10px] font-bold text-ink">TEAM</span>}
                    {(isAdmin || (r.author === p.viewerName && r.role === p.role)) && (
                      <button type="button" onClick={() => remove(r)} className="ml-auto text-stone hover:text-red-400">delete</button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-cream/90">{r.text}</p>
                </div>
              ))}

              <div className="mt-2 flex gap-3 text-xs text-cream/60">
                <button type="button" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)} className="hover:text-cream">Reply</button>
                <button type="button" onClick={() => toggleResolved(c)} className="hover:text-cream">
                  {c.resolved ? "Reopen" : "Mark resolved"}
                </button>
                {(isAdmin || (c.author === p.viewerName && c.role === p.role)) && (
                  <button type="button" onClick={() => remove(c)} className="ml-auto hover:text-red-400">Delete</button>
                )}
              </div>

              {replyTo === c.id && (
                <div className="mt-2 flex gap-2">
                  <input
                    className="field"
                    placeholder="Write a reply…"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && replyText.trim() && addReply(c.id)}
                  />
                  <button type="button" className="btn" disabled={busy || !replyText.trim()} onClick={() => addReply(c.id)}>
                    Send
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-line p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded bg-sun px-1.5 py-0.5 font-mono font-bold text-ink">{startLabel}</span>
            {rangeEnd != null ? (
              <>
                <span>→</span>
                <span className="rounded bg-sun px-1.5 py-0.5 font-mono font-bold text-ink">{formatTc(rangeEnd, p.fps)}</span>
                <button type="button" className="text-cream/60 underline" onClick={() => { setRangeEnd(null); setRangeStart(null); }}>clear range</button>
              </>
            ) : (
              <button
                type="button"
                className="text-cream/60 underline hover:text-cream"
                onClick={() => {
                  const now = snapToFrame(timeRef.current, p.fps);
                  if (rangeStart == null) setRangeStart(now);
                  else if (now > rangeStart) setRangeEnd(now);
                }}
                title="Click once to set the start, play or scrub to the end, click again to set the end"
              >
                {rangeStart == null ? "+ comment on a range" : "set range end here"}
              </button>
            )}
          </div>
          <textarea
            className="field min-h-20 resize-y"
            placeholder="Leave feedback at this moment…"
            value={text}
            maxLength={2000}
            onFocus={() => playerRef.current?.pause()}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && text.trim()) void addComment();
            }}
          />
          {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
          <div className="mt-2 flex items-center gap-3">
            {isAdmin && (
              <label className="flex items-center gap-1.5 text-xs text-cream/80">
                <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                Internal (team only)
              </label>
            )}
            <span className="text-xs text-stone">as {p.viewerName}</span>
            <button type="button" className="btn ml-auto" disabled={busy || !text.trim()} onClick={addComment}>
              Comment
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
