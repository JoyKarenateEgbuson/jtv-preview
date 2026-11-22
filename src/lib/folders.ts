// Pure rules about folders: who can see what, and in what order. No database or React in here,
// so the rules can be tested on their own. Types are imported as types only.
import type { Folder, ShareLink, Video } from "./types";

/** "Ep 2" sorts before "Ep 10". */
export const natural = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

/** The folders from the top level down to `id` (inclusive). Empty for the top level. */
export function folderChain(all: Folder[], id: string | null | undefined): Folder[] {
  const byId = new Map(all.map((f) => [f.id, f]));
  const chain: Folder[] = [];
  const seen = new Set<string>();
  for (let cur = id ? byId.get(id) : undefined; cur && !seen.has(cur.id); cur = cur.parentId ? byId.get(cur.parentId) : undefined) {
    seen.add(cur.id);
    chain.unshift(cur);
  }
  return chain;
}

/** `id` plus every folder inside it, however deep. */
export function descendantIds(all: Folder[], id: string): string[] {
  const out = [id];
  for (let i = 0; i < out.length; i++) {
    for (const f of all) if (f.parentId === out[i] && !out.includes(f.id)) out.push(f.id);
  }
  return out;
}

/* ---------- clients (people with a private page) ---------- */

/** A person can open a folder if it, or any folder above it, was shared with them. */
export const personCanSeeFolder = (personId: string, all: Folder[], folderId: string) =>
  folderChain(all, folderId).some((f) => f.personIds.includes(personId));

/** A person can open a video if it was shared directly, or sits in a folder shared with them. */
export const personCanSeeVideo = (personId: string, all: Folder[], video: Video) =>
  video.personIds.includes(personId) || personCanSeeFolder(personId, all, video.folderId ?? "");

/** The folders shown on a person's page: the highest ones shared with them (not their sub-folders). */
export function sharedRootFolders(personId: string, all: Folder[]): Folder[] {
  return all.filter(
    (f) => f.personIds.includes(personId) && !folderChain(all, f.parentId).some((a) => a.personIds.includes(personId)),
  );
}

/** Videos shared with a person one by one that are NOT already inside a folder shared with them. */
export const looseVideosFor = (personId: string, all: Folder[], videos: Video[]) =>
  videos.filter((v) => v.personIds.includes(personId) && !personCanSeeFolder(personId, all, v.folderId ?? ""));

/** For breadcrumbs: only the part of the path a person is allowed to see (from their highest shared folder). */
export function visibleChain(personId: string, all: Folder[], folderId: string): Folder[] {
  const chain = folderChain(all, folderId);
  const first = chain.findIndex((f) => f.personIds.includes(personId));
  return first === -1 ? [] : chain.slice(first);
}

/* ---------- share links ---------- */

/** What a folder link may open: the link's folder, everything inside it, nothing else. */
export function linkAllowsFolder(link: ShareLink, all: Folder[], folderId: string): boolean {
  return !!link.folderId && descendantIds(all, link.folderId).includes(folderId);
}
export function linkAllowsVideo(link: ShareLink, all: Folder[], video: Video): boolean {
  if (link.folderId) return !!video.folderId && linkAllowsFolder(link, all, video.folderId);
  return link.videoId === video.id; // single-video link
}
/** Breadcrumb for a folder link: starts at the link's own folder. */
export function linkChain(link: ShareLink, all: Folder[], folderId: string): Folder[] {
  const chain = folderChain(all, folderId);
  const start = chain.findIndex((f) => f.id === link.folderId);
  return start === -1 ? [] : chain.slice(start);
}

/* ---------- episodes ---------- */

/** Newest version of each piece (a "stack"), as one list. */
export function latestPerStack(videos: Video[]): Video[] {
  const best = new Map<string, Video>();
  for (const v of videos) {
    const cur = best.get(v.stackId);
    if (!cur || v.version > cur.version) best.set(v.stackId, v);
  }
  return [...best.values()];
}

/** The episodes of one folder in play order (natural title order), one entry per piece. */
export const episodesIn = (videos: Video[], folderId: string | null) =>
  latestPerStack(videos.filter((v) => (v.folderId ?? null) === (folderId ?? null))).sort((a, b) =>
    natural(a.title, b.title),
  );
