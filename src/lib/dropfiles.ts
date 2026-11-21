// Helpers for the uploader: turn "whatever the person dropped or picked" into a clean,
// ordered list of video files, including whole folders (nested folders too).
// No React or DOM imports, so it can be tested on its own.

export type PickedFile = { file: File; path: string };

/** Just the parts of the browser's folder-entry objects that we use. */
export type EntryLike = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath?: string;
  file?: (ok: (f: File) => void, fail: (e: unknown) => void) => void;
  createReader?: () => { readEntries: (ok: (list: EntryLike[]) => void, fail: (e: unknown) => void) => void };
};

const VIDEO_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  mpg: "video/mpeg",
  mpeg: "video/mpeg",
};

/** The file's video type, or null if it isn't a video. Some systems report folders' files with no type. */
export function videoMime(file: File): string | null {
  if (file.type.startsWith("video/")) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return VIDEO_TYPES[ext] ?? null;
}

const isJunk = (path: string) =>
  path.split("/").some((part) => part.startsWith(".") || part === "__MACOSX" || part.toLowerCase() === "thumbs.db");

/** Files picked with a folder button or a normal file picker. */
export function fromFileList(files: ArrayLike<File>): PickedFile[] {
  return Array.from(files).map((file) => ({
    file,
    path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
  }));
}

async function walk(entry: EntryLike, out: PickedFile[]): Promise<void> {
  if (entry.isFile && entry.file) {
    const file = await new Promise<File>((ok, fail) => entry.file!(ok, fail));
    out.push({ file, path: (entry.fullPath ?? `/${entry.name}`).replace(/^\//, "") });
  } else if (entry.isDirectory && entry.createReader) {
    const reader = entry.createReader();
    // readEntries hands back at most ~100 items per call, so keep asking until it's empty.
    for (;;) {
      const batch = await new Promise<EntryLike[]>((ok, fail) => reader.readEntries(ok, fail));
      if (batch.length === 0) break;
      for (const child of batch) await walk(child, out);
    }
  }
}

/** Everything inside dropped files and folders (the entries must be captured during the drop event). */
export async function collectFromEntries(entries: EntryLike[]): Promise<PickedFile[]> {
  const out: PickedFile[] = [];
  for (const entry of entries) await walk(entry, out);
  return out;
}

/** Keep only videos, skip hidden/system files, and put them in natural order (Ep 2 before Ep 10). */
export function onlyVideos(list: PickedFile[]): { videos: PickedFile[]; skipped: number } {
  const videos = list.filter((p) => !isJunk(p.path) && videoMime(p.file) !== null);
  videos.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: "base" }));
  return { videos, skipped: list.filter((p) => !isJunk(p.path)).length - videos.length };
}
