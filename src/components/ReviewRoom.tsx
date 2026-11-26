"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDate, formatTc, snapToFrame } from "@/lib/time";
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
  /** The other videos in the same folder, in play order (this one included). */
  nav?: { items: { id: string; title: string; href: string }[]; currentId: string } | null;
  /** Start playing right away (set when arriving from "up next"). */
  autoPlay?: boolean;
};

type Filter = "all" | "open" | "resolved";
type MenuItem = { label: string; danger?: boolean; run: () => void };

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
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const router = useRouter();
  // The video address is fixed for the life of the page, so changing your name (which makes a
  // fresh token) never restarts the video you're watching.
  const [src] = useState(() => `/api/stream/${p.videoId}?t=${encodeURIComponent(p.token)}`);
  const q = `t=${encodeURIComponent(p.token)}`;

  // Where "next" and "previous" lead, from the folder's play order.
  const navItems = p.nav?.items ?? [];
  const navIndex = p.nav ? navItems.findIndex((i) => i.id === p.nav!.currentId) : -1;
  const prevItem = navIndex > 0 ? navItems[navIndex - 1] : null;
  const nextItem = navIndex >= 0 && navIndex < navItems.length - 1 ? navItems[navIndex + 1] : null;
  const goNext = nextItem
    ? () => router.push(`${nextItem.href}${nextItem.href.includes("?") ? "&" : "?"}autoplay=1`)
    : null;
  const isAdmin = p.role === "admin";
  const isOwn = (c: Comment) => c.author === p.viewerName && c.role === p.role;

  const load = useCallback(async () => {
    const res = await fetch(`/api/comments?${q}`, { cache: "no-store" });
    if (res.ok) setComments((await res.json()) as Comment[]);
  }, [q]);

  useEffect(() => {
    // Initial load, then poll so new feedback shows up without a refresh.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const id = window.setInterval(load, 8000);
    return () => window.clearInterval(id);
  }, [load]);

  /* Close an open comment menu when clicking anywhere else. */
  useEffect(() => {
    if (!menuFor) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest("[data-comment-menu]")) setMenuFor(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menuFor]);

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

  async function failMessage(res: Response, fallback: string) {
    setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? fallback);
  }

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
      await failMessage(res, "Could not post");
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
    setError("");
    const res = await fetch(`/api/comments/${c.id}?${q}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: !c.resolved }),
    });
    if (!res.ok) await failMessage(res, "Could not update");
    await load();
  }

  async function saveEdit(c: Comment) {
    setError("");
    const res = await fetch(`/api/comments/${c.id}?${q}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: editText }),
    });
    if (!res.ok) {
      await failMessage(res, "Could not save");
      return;
    }
    setEditing(null);
    await load();
  }

  async function remove(c: Comment) {
    if (!confirm("Delete this comment?")) return;
    setError("");
    const res = await fetch(`/api/comments/${c.id}?${q}`, { method: "DELETE" });
    if (!res.ok) await failMessage(res, "Could not delete");
    await load();
  }

  /** What the "⋮" menu offers on a comment, depending on who is looking. Empty = no menu. */
  function menuItems(c: Comment): MenuItem[] {
    const items: MenuItem[] = [];
    if (isOwn(c)) {
      items.push({
        label: "Edit",
        run: () => {
          setEditing(c.id);
          setEditText(c.text);
        },
      });
    }
    if (isAdmin && !c.parentId) {
      items.push({ label: c.resolved ? "Reopen" : "Mark resolved", run: () => void toggleResolved(c) });
    }
    if (isAdmin || isOwn(c)) items.push({ label: "Delete", danger: true, run: () => void remove(c) });
    return items;
  }

  function renderMenu(c: Comment) {
    const items = menuItems(c);
    if (items.length === 0) return null;
    return (
      <div className="relative" data-comment-menu>
        <button
          type="button"
          aria-label="Comment options"
          aria-haspopup="menu"
          aria-expanded={menuFor === c.id}
          onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}
          className="grid h-6 w-6 place-items-center rounded-lg text-cream/70 hover:bg-white/10 hover:text-cream"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
            <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
          </svg>
        </button>
        {menuFor === c.id && (
          <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-xl border border-line bg-panel py-1 shadow-xl">
            {items.map((it) => (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuFor(null);
                  it.run();
                }}
                className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-white/10 ${it.danger ? "text-red-400" : ""}`}
              >
                {it.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderEditBox(c: Comment) {
    return (
      <div className="mt-2 space-y-2">
        <textarea
          className="field min-h-16 resize-y"
          value={editText}
          maxLength={2000}
          autoFocus
          onChange={(e) => setEditText(e.target.value)}
        />
        <div className="flex gap-2">
          <button type="button" className="btn" disabled={!editText.trim()} onClick={() => void saveEdit(c)}>Save</button>
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
        </div>
      </div>
    );
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
    <div>
      <div className="min-w-0">
        <VideoPlayer
          ref={playerRef}
          src={src}
          fps={p.fps}
          watermarkName={p.watermarkName}
          markers={markers}
          rangePreview={rangeStart != null || rangeEnd != null ? { start: rangeStart ?? time, end: rangeEnd } : null}
          onTime={onTime}
          canSaveStill={p.canDownload}
          stillName={p.title}
          autoPlay={p.autoPlay}
          next={nextItem && goNext ? { title: nextItem.title, go: goNext } : null}
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
            <a className="btn btn-ghost ml-auto" href={`/api/download/${p.videoId}?${q}`}>
              Download
            </a>
          )}
        </div>
        <p className="mt-1 text-xs text-stone">
          Space play/pause · ← → step one frame · Shift+← → jump 5s · F fullscreen
        </p>

        {navItems.length > 1 && (
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {prevItem ? (
                <Link href={prevItem.href} className="btn btn-ghost !px-3 !py-1.5">‹ Previous</Link>
              ) : (
                <span className="btn btn-ghost pointer-events-none !px-3 !py-1.5 opacity-40">‹ Previous</span>
              )}
              <span className="text-cream/70">{navIndex + 1} of {navItems.length}</span>
              {nextItem ? (
                <Link href={nextItem.href} className="btn btn-ghost !px-3 !py-1.5">Next ›</Link>
              ) : (
                <span className="btn btn-ghost pointer-events-none !px-3 !py-1.5 opacity-40">Next ›</span>
              )}
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1" aria-label="Videos in this folder">
              {navItems.map((it) => (
                <Link
                  key={it.id}
                  href={it.href}
                  aria-current={it.id === p.nav?.currentId ? "page" : undefined}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                    it.id === p.nav?.currentId ? "bg-brand text-ink" : "border border-line text-cream/70 hover:bg-panel"
                  }`}
                >
                  {it.title}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* On wide screens the comments sit in a full-height column down the right edge of the window. */}
      <aside className="card mt-4 flex max-h-[75vh] min-h-[420px] flex-col overflow-hidden lg:fixed lg:inset-y-0 lg:right-0 lg:z-20 lg:mt-0 lg:h-dvh lg:max-h-none lg:w-[380px] lg:rounded-none lg:border-y-0 lg:border-r-0">
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

        <div data-lenis-prevent className="flex-1 space-y-3 overflow-y-auto p-4">
          {shown.length === 0 && (
            <p className="py-8 text-center text-sm text-stone">
              {top.length === 0 ? "No comments yet. Pause the video and add the first one." : "Nothing in this filter."}
            </p>
          )}
          {shown.map((c) => (
            <div key={c.id} className={`comment-in rounded-xl border p-3 ${c.internal ? "border-magenta/60 bg-magenta/10" : "border-line bg-white/[0.03]"} ${c.resolved ? "opacity-70" : ""}`}>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    playerRef.current?.pause();
                    playerRef.current?.seek(c.time);
                  }}
                  className="shrink-0 whitespace-nowrap rounded-lg bg-sun px-1.5 py-0.5 font-mono font-bold text-ink hover:brightness-110"
                  title="Jump to this moment"
                >
                  {formatTc(c.time, p.fps)}
                  {c.timeEnd != null && ` → ${formatTc(c.timeEnd, p.fps)}`}
                </button>
                <span className="min-w-0 truncate font-semibold">{c.author}</span>
                {c.role === "admin" && <span className="shrink-0 rounded-lg bg-brand px-1.5 text-[10px] font-bold text-ink">TEAM</span>}
                {c.internal && <span className="shrink-0 rounded-lg bg-magenta px-1.5 text-[10px] font-bold">INTERNAL</span>}
                <span className="ml-auto shrink-0 whitespace-nowrap text-stone">{formatDate(c.createdAt)}</span>
                {renderMenu(c)}
              </div>

              {editing === c.id ? (
                renderEditBox(c)
              ) : (
                <p className="mt-2 whitespace-pre-wrap text-sm">
                  {c.text}
                  {c.editedAt ? <span className="ml-1 text-xs text-stone">(edited)</span> : null}
                </p>
              )}

              {c.resolved && (
                <p className="mt-2 text-xs font-semibold text-sun">✓ Resolved</p>
              )}

              {repliesOf(c.id).map((r) => (
                <div key={r.id} className="mt-2 border-l-2 border-line pl-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="min-w-0 truncate font-semibold">{r.author}</span>
                    {r.role === "admin" && <span className="shrink-0 rounded-lg bg-brand px-1.5 text-[10px] font-bold text-ink">TEAM</span>}
                    <span className="ml-auto shrink-0 whitespace-nowrap text-stone">{formatDate(r.createdAt)}</span>
                    {renderMenu(r)}
                  </div>
                  {editing === r.id ? (
                    renderEditBox(r)
                  ) : (
                    <p className="whitespace-pre-wrap text-sm text-cream/90">
                      {r.text}
                      {r.editedAt ? <span className="ml-1 text-xs text-stone">(edited)</span> : null}
                    </p>
                  )}
                </div>
              ))}

              <div className="mt-2 flex gap-3 text-xs text-cream/60">
                <button type="button" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)} className="hover:text-cream">Reply</button>
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
            <span className="rounded-lg bg-sun px-1.5 py-0.5 font-mono font-bold text-ink">{startLabel}</span>
            {rangeEnd != null ? (
              <>
                <span>→</span>
                <span className="rounded-lg bg-sun px-1.5 py-0.5 font-mono font-bold text-ink">{formatTc(rangeEnd, p.fps)}</span>
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
