import { linkCode, newId } from "./crypto";
import { store } from "./db/store";
import { descendantIds } from "./folders";
import type { Comment, Folder, Person, ShareLink, Video } from "./types";

const byNewest = <T extends { createdAt: number }>(a: T, b: T) => b.createdAt - a.createdAt;

/* ---------- people (clients + guests) ---------- */

export async function listPeople(): Promise<Person[]> {
  return (await store().list<Person>("people")).sort(byNewest);
}
export const getPerson = (id: string) => store().get<Person>("people", id);

export async function getPersonByToken(token: string): Promise<Person | null> {
  return (await store().list<Person>("people", { field: "token", value: token }))[0] ?? null;
}

export async function createPerson(name: string, kind: Person["kind"]): Promise<Person> {
  const person: Person = { id: newId(), name, kind, token: linkCode(), createdAt: Date.now() };
  await store().set("people", person);
  return person;
}

export const updatePerson = (id: string, patch: Partial<Pick<Person, "name" | "kind" | "token">>) =>
  store().update("people", id, patch);

export async function deletePerson(id: string) {
  await store().remove("people", id);
  // Un-share from any video or folder that referenced them.
  for (const v of await listVideos()) {
    if (v.personIds.includes(id)) {
      await updateVideo(v.id, { personIds: v.personIds.filter((p) => p !== id) });
    }
  }
  for (const f of await listFolders()) {
    if (f.personIds.includes(id)) {
      await updateFolder(f.id, { personIds: f.personIds.filter((p) => p !== id) });
    }
  }
}

/* ---------- videos ---------- */

export async function listVideos(): Promise<Video[]> {
  return (await store().list<Video>("videos")).sort(byNewest);
}
export const getVideo = (id: string) => store().get<Video>("videos", id);

export async function listStack(stackId: string): Promise<Video[]> {
  return (await store().list<Video>("videos", { field: "stackId", value: stackId })).sort(
    (a, b) => a.version - b.version,
  );
}

export async function createVideo(
  input: Pick<Video, "title" | "storage" | "fileRef" | "mimeType" | "size"> & {
    stackId?: string;
    folderId?: string | null;
  },
): Promise<Video> {
  let version = 1;
  let personIds: string[] = [];
  let carry: Partial<Video> = {};
  let folderId = input.folderId ?? null;
  if (input.stackId) {
    const stack = await listStack(input.stackId);
    const latest = stack[stack.length - 1];
    if (latest) {
      version = latest.version + 1;
      // A new version inherits the previous version's audience, settings and folder.
      personIds = latest.personIds;
      folderId = latest.folderId ?? null;
      carry = { fps: latest.fps, watermark: latest.watermark, allowDownload: latest.allowDownload };
    }
  }
  const id = newId();
  const video: Video = {
    id,
    title: input.title,
    folderId,
    stackId: input.stackId ?? id,
    version,
    storage: input.storage,
    fileRef: input.fileRef,
    mimeType: input.mimeType,
    size: input.size,
    fps: 24,
    watermark: true,
    allowDownload: false,
    personIds,
    createdAt: Date.now(),
    ...carry,
  };
  await store().set("videos", video);
  return video;
}

export const updateVideo = (id: string, patch: Partial<Video>) =>
  store().update("videos", id, patch as Record<string, unknown>);

export async function deleteVideoRecords(id: string) {
  for (const l of await listLinks(id)) await store().remove("links", l.id);
  for (const c of await listComments(id)) await store().remove("comments", c.id);
  await store().remove("videos", id);
}

/* ---------- folders ---------- */

export async function listFolders(): Promise<Folder[]> {
  return (await store().list<Folder>("folders")).sort(byNewest);
}
export const getFolder = (id: string) => store().get<Folder>("folders", id);

/** Creates a folder, or returns the existing one with the same name in the same place (so re-uploading merges). */
export async function createFolder(name: string, parentId: string | null): Promise<Folder> {
  const existing = (await listFolders()).find(
    (f) => (f.parentId ?? null) === parentId && f.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) return existing;
  const folder: Folder = { id: newId(), name, parentId, personIds: [], createdAt: Date.now() };
  await store().set("folders", folder);
  return folder;
}

export const updateFolder = (id: string, patch: Partial<Pick<Folder, "name" | "parentId" | "personIds">>) =>
  store().update("folders", id, patch);

/**
 * Deletes a folder and everything inside it: subfolders, videos, comments and links.
 * Returns the videos that were removed, so the caller can also delete their files.
 */
export async function deleteFolderTree(id: string): Promise<Video[]> {
  const folders = await listFolders();
  const ids = descendantIds(folders, id);
  const videos = (await listVideos()).filter((v) => v.folderId && ids.includes(v.folderId));
  for (const v of videos) await deleteVideoRecords(v.id);
  for (const fid of ids) {
    for (const l of await listFolderLinks(fid)) await store().remove("links", l.id);
    await store().remove("folders", fid);
  }
  return videos;
}

/* ---------- share links ---------- */

export async function listLinks(videoId: string): Promise<ShareLink[]> {
  return (await store().list<ShareLink>("links", { field: "videoId", value: videoId })).sort(byNewest);
}

export async function listFolderLinks(folderId: string): Promise<ShareLink[]> {
  return (await store().list<ShareLink>("links", { field: "folderId", value: folderId })).sort(byNewest);
}

export async function getLinkByToken(token: string): Promise<ShareLink | null> {
  return (await store().list<ShareLink>("links", { field: "token", value: token }))[0] ?? null;
}

export async function createLink(
  input: Pick<ShareLink, "label" | "viewerName" | "expiresAt"> & { videoId?: string; folderId?: string | null },
): Promise<ShareLink> {
  const link: ShareLink = {
    id: newId(),
    token: linkCode(),
    createdAt: Date.now(),
    ...input,
    videoId: input.videoId ?? "",
    folderId: input.folderId ?? null,
  };
  await store().set("links", link);
  return link;
}

export const deleteLink = (id: string) => store().remove("links", id);

/* ---------- comments ---------- */

export async function listComments(videoId: string): Promise<Comment[]> {
  return (await store().list<Comment>("comments", { field: "videoId", value: videoId })).sort(
    (a, b) => a.time - b.time || a.createdAt - b.createdAt,
  );
}

export const getComment = (id: string) => store().get<Comment>("comments", id);

export async function createComment(
  input: Pick<Comment, "videoId" | "author" | "role" | "time" | "timeEnd" | "text" | "internal" | "parentId">,
): Promise<Comment> {
  const comment: Comment = { id: newId(), resolved: false, createdAt: Date.now(), ...input };
  await store().set("comments", comment);
  return comment;
}

export const updateComment = (id: string, patch: Partial<Comment>) =>
  store().update("comments", id, patch as Record<string, unknown>);

export async function deleteComment(c: Comment) {
  // Remove the comment and any replies under it.
  const all = await listComments(c.videoId);
  for (const r of all.filter((x) => x.parentId === c.id)) await store().remove("comments", r.id);
  await store().remove("comments", c.id);
}
