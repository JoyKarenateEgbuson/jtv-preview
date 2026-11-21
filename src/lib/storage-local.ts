// Dev-only storage on local disk. Imported lazily (dynamic import) and only when
// Google Drive isn't configured, so the Cloudflare Worker bundle never runs this code.
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { StreamResult } from "./storage";
import type { Video } from "./types";

const localDir = path.join(process.cwd(), ".data", "videos");

function parseRange(header: string | null, size: number): { start: number; end: number } | "invalid" | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return "invalid";
  let start = m[1] === "" ? NaN : parseInt(m[1], 10);
  let end = m[2] === "" ? NaN : parseInt(m[2], 10);
  if (Number.isNaN(start) && Number.isNaN(end)) return "invalid";
  if (Number.isNaN(start)) {
    start = Math.max(0, size - end);
    end = size - 1;
  } else if (Number.isNaN(end) || end >= size) {
    end = size - 1;
  }
  if (start > end || start >= size) return "invalid";
  return { start, end };
}

export async function saveLocalUpload(ref: string, body: ReadableStream) {
  await fs.mkdir(localDir, { recursive: true });
  await pipeline(
    Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]),
    createWriteStream(path.join(localDir, ref)),
  );
}

export async function removeLocalFile(ref: string) {
  await fs.rm(path.join(localDir, ref), { force: true });
}

export async function openLocalStream(video: Pick<Video, "fileRef" | "mimeType">, rangeHeader: string | null): Promise<StreamResult> {
  const file = path.join(localDir, video.fileRef);
  let size: number;
  try {
    size = (await fs.stat(file)).size;
  } catch {
    return { status: 404, headers: {}, body: null };
  }
  const range = parseRange(rangeHeader, size);
  if (range === "invalid") {
    return { status: 416, headers: { "Content-Range": `bytes */${size}` }, body: null };
  }
  const { start, end } = range ?? { start: 0, end: size - 1 };
  const body = Readable.toWeb(createReadStream(file, { start, end })) as unknown as ReadableStream;
  return {
    status: range ? 206 : 200,
    headers: {
      "Content-Type": video.mimeType,
      "Content-Length": String(end - start + 1),
      ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
    },
    body,
  };
}
