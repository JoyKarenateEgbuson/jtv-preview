import { storageMode } from "./config";
import { store } from "./db/store";
import { fetchDriveMedia, mediaHeaders } from "./drivestream";
import { driveToken } from "./google";
import type { Video } from "./types";

const DRIVE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";

export const isValidLocalRef = (ref: string) => /^[a-f0-9-]{36}$/.test(ref);

/* ---------- uploads ---------- */

async function driveFolder(): Promise<string> {
  const saved = await store().get<{ id: string; folderId: string }>("settings", "drive");
  if (saved?.folderId) return saved.folderId;
  // With the drive.file scope the app can only touch files it made, so it makes its own folder.
  const res = await fetch(`${DRIVE}/files?fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await driveToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "JTV Reviews", mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!res.ok) throw new Error(`Could not create Drive folder: ${res.status} ${await res.text()}`);
  const { id } = (await res.json()) as { id: string };
  await store().set("settings", { id: "drive", folderId: id });
  return id;
}

export type UploadInit =
  | { kind: "drive"; uploadUrl: string }
  | { kind: "local"; uploadUrl: string; fileRef: string };

export async function initUpload(opts: {
  name: string;
  size: number;
  mimeType: string;
  origin: string;
}): Promise<UploadInit> {
  if (storageMode() === "local") {
    const fileRef = crypto.randomUUID();
    return { kind: "local", fileRef, uploadUrl: `/api/admin/upload/local/${fileRef}` };
  }
  // Resumable session: the browser then uploads straight to Google, so big files
  // never pass through this server. `Origin` makes the session usable from the browser.
  const res = await fetch(`${DRIVE_UPLOAD}/files?uploadType=resumable&fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await driveToken()}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": opts.mimeType,
      "X-Upload-Content-Length": String(opts.size),
      Origin: opts.origin,
    },
    body: JSON.stringify({ name: opts.name, parents: [await driveFolder()] }),
  });
  const uploadUrl = res.headers.get("location");
  if (!res.ok || !uploadUrl) {
    throw new Error(`Could not start Drive upload: ${res.status} ${await res.text()}`);
  }
  return { kind: "drive", uploadUrl };
}

export async function removeFile(video: Video) {
  if (video.storage === "drive") {
    await fetch(`${DRIVE}/files/${video.fileRef}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${await driveToken()}` },
    });
  } else if (isValidLocalRef(video.fileRef)) {
    await (await import("./storage-local")).removeLocalFile(video.fileRef);
  }
}

/* ---------- streaming (the proxy) ---------- */

export type StreamResult = { status: number; headers: Record<string, string>; body: BodyInit | null };

/** Opens the video bytes (honouring HTTP Range) from Drive or local disk. */
export async function openStream(
  video: Pick<Video, "storage" | "fileRef" | "mimeType">,
  rangeHeader: string | null,
): Promise<StreamResult> {
  if (video.storage === "drive") {
    const upstream = await fetchDriveMedia(video.fileRef, rangeHeader);
    return { status: upstream.status, headers: mediaHeaders(upstream, video.mimeType), body: upstream.body };
  }

  if (!isValidLocalRef(video.fileRef)) return { status: 404, headers: {}, body: null };
  return (await import("./storage-local")).openLocalStream(video, rangeHeader);
}
