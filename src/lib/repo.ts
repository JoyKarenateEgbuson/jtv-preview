import { newId, randomToken } from "./crypto";
import { store } from "./db/store";
import type { Comment, Person, ShareLink, Video } from "./types";

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
  const person: Person = { id: newId(), name, kind, token: randomToken(), createdAt: Date.now() };
  await store().set("people", person);
  return person;
}

export const updatePerson = (id: string, patch: Partial<Pick<Person, "name" | "kind" | "token">>) =>
  store().update("people", id, patch);

export async function deletePerson(id: string) {
  await store().remove("people", id);
  // Un-share from any video that referenced them.
  for (const v of await listVideos()) {
    if (v.personIds.includes(id)) {
      await updateVideo(v.id, { personIds: v.personIds.filter((p) => p !== id) });
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
  input: Pick<Video, "title" | "storage" | "fileRef" | "mimeType" | "size"> & { stackId?: string },
): Promise<Video> {
  let version = 1;
  let personIds: string[] = [];
  let carry: Partial<Video> = {};
  if (input.stackId) {
    const stack = await listStack(input.stackId);
    const latest = stack[stack.length - 1];
    if (latest) {
      version = latest.version + 1;
      // A new version inherits the previous version's audience and settings.
      personIds = latest.personIds;
      carry = { fps: latest.fps, watermark: latest.watermark, allowDownload: latest.allowDownload };
    }
  }
  const id = newId();
  const video: Video = {
    id,
    title: input.title,
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

/* ---------- share links ---------- */

export async function listLinks(videoId: string): Promise<ShareLink[]> {
  return (await store().list<ShareLink>("links", { field: "videoId", value: videoId })).sort(byNewest);
}

export async function getLinkByToken(token: string): Promise<ShareLink | null> {
  return (await store().list<ShareLink>("links", { field: "token", value: token }))[0] ?? null;
}

export async function createLink(
  input: Pick<ShareLink, "videoId" | "label" | "viewerName" | "expiresAt">,
): Promise<ShareLink> {
  const link: ShareLink = { id: newId(), token: randomToken(), createdAt: Date.now(), ...input };
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
