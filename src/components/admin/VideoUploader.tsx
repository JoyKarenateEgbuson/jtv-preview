"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type InputHTMLAttributes } from "react";
import {
  collectFromEntries,
  fromFileList,
  onlyVideos,
  videoMime,
  type EntryLike,
  type PickedFile,
} from "@/lib/dropfiles";

const CHUNK = 8 * 1024 * 1024; // multiple of 256 KiB, as Drive requires

type PutResult = { status: number; body: string };

function put(url: string, body: Blob, headers: Record<string, string>, onProgress: (loaded: number) => void) {
  return new Promise<PutResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(body);
  });
}

// `webkitdirectory` makes the picker choose a whole folder. React's types don't know it yet.
const folderInputProps = { webkitdirectory: "", directory: "" } as unknown as InputHTMLAttributes<HTMLInputElement>;

/**
 * Uploads videos: pick files, pick a whole folder, or drag either in. Folders (and nested
 * folders) are searched for videos, which upload one after another in natural order.
 * With `stackId` it adds a single new version of that video instead.
 */
export default function VideoUploader({ stackId, label = "Upload videos" }: { stackId?: string; label?: string }) {
  const router = useRouter();
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [percent, setPercent] = useState(0);
  const [busy, setBusy] = useState(false);

  async function uploadOne(item: PickedFile, n: number, total: number) {
    const { file } = item;
    const prefix = total > 1 ? `(${n}/${total}) ` : "";
    setStatus(`${prefix}Preparing ${file.name}…`);
    setPercent(0);
    const mimeType = videoMime(file) ?? "video/mp4";

    const initRes = await fetch("/api/admin/upload/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, size: file.size, mimeType }),
    });
    const init = (await initRes.json()) as { kind: "drive" | "local"; uploadUrl: string; fileRef?: string; error?: string };
    if (!initRes.ok) throw new Error(init.error ?? "Could not start upload");

    setStatus(`${prefix}Uploading ${file.name}…`);
    let fileRef = init.fileRef ?? "";

    if (init.kind === "local") {
      const r = await put(init.uploadUrl, file, { "Content-Type": mimeType }, (l) => setPercent((l / file.size) * 100));
      if (r.status >= 300) throw new Error("Upload failed");
    } else {
      // Resumable upload straight to Google Drive, in chunks.
      for (let start = 0; start < file.size; start += CHUNK) {
        const end = Math.min(start + CHUNK, file.size);
        let attempt = 0;
        for (;;) {
          try {
            const r = await put(
              init.uploadUrl,
              file.slice(start, end),
              { "Content-Range": `bytes ${start}-${end - 1}/${file.size}` },
              (l) => setPercent(((start + l) / file.size) * 100),
            );
            if (r.status === 308) break; // chunk accepted, more to come
            if (r.status === 200 || r.status === 201) {
              fileRef = (JSON.parse(r.body) as { id: string }).id;
              break;
            }
            throw new Error(`Drive returned ${r.status}`);
          } catch (e) {
            if (++attempt >= 3) throw e;
          }
        }
      }
      if (!fileRef) throw new Error("Drive did not return a file id");
    }

    const reg = await fetch("/api/admin/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: file.name.replace(/\.[^.]+$/, ""),
        fileRef,
        mimeType,
        size: file.size,
        stackId,
      }),
    });
    if (!reg.ok) throw new Error(((await reg.json()) as { error?: string }).error ?? "Could not save video");
  }

  /** Takes whatever was picked or dropped, keeps the videos, and uploads them one by one. */
  async function run(read: () => Promise<PickedFile[]>) {
    setBusy(true);
    setStatus("Looking for videos…");
    setPercent(0);
    try {
      const { videos, skipped } = onlyVideos(await read());
      if (videos.length === 0) {
        setStatus(
          skipped
            ? "No video files found. Only videos are uploaded (MP4 is best)."
            : "Nothing to upload. Choose or drop video files, or a folder of videos.",
        );
        return;
      }
      // A new version is one file; take the first if several were given.
      const queue = stackId ? videos.slice(0, 1) : videos;
      const failed: string[] = [];
      for (let i = 0; i < queue.length; i++) {
        try {
          await uploadOne(queue[i], i + 1, queue.length);
        } catch (e) {
          failed.push(`${queue[i].file.name} (${(e as Error).message})`);
        }
      }
      const ok = queue.length - failed.length;
      const notes = [
        skipped ? `${skipped} non-video file${skipped > 1 ? "s" : ""} skipped` : "",
        stackId && videos.length > 1 ? "only the first video was used for this version" : "",
      ].filter(Boolean);
      setStatus(
        failed.length
          ? `${ok} uploaded, ${failed.length} failed: ${failed.join("; ")}`
          : `Done ✓ ${ok} video${ok > 1 ? "s" : ""} uploaded${notes.length ? ` · ${notes.join(" · ")}` : ""}`,
      );
      router.refresh();
    } catch (e) {
      setStatus(`Failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      if (filesInput.current) filesInput.current.value = "";
      if (folderInput.current) folderInput.current.value = "";
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    if (busy) return;
    // The dropped items are only readable during this event, so capture them before any waiting.
    const entries = Array.from(e.dataTransfer.items ?? [])
      .map((i) => (i.kind === "file" ? (i.webkitGetAsEntry() as EntryLike | null) : null))
      .filter((x): x is EntryLike => !!x);
    const plain = Array.from(e.dataTransfer.files);
    void run(() => (entries.length ? collectFromEntries(entries) : Promise.resolve(fromFileList(plain))));
  }

  return (
    <div
      className="rounded-xl border-2 border-dashed border-line p-5 text-center"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <input
        ref={filesInput}
        type="file"
        accept="video/*"
        multiple={!stackId}
        hidden
        onChange={(e) => {
          const list = e.target.files ? fromFileList(e.target.files) : [];
          void run(() => Promise.resolve(list));
        }}
      />
      {!stackId && (
        <input
          ref={folderInput}
          type="file"
          multiple
          hidden
          {...folderInputProps}
          onChange={(e) => {
            const list = e.target.files ? fromFileList(e.target.files) : [];
            void run(() => Promise.resolve(list));
          }}
        />
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" className="btn" disabled={busy} onClick={() => filesInput.current?.click()}>
          {busy ? "Uploading…" : label}
        </button>
        {!stackId && (
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => folderInput.current?.click()}>
            Upload a folder
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-stone">
        {stackId
          ? "or drag a video here. Use an H.264 MP4 export so it plays in every browser."
          : "or drag and drop videos, or a whole folder of videos. Use H.264 MP4 exports so they play in every browser."}
      </p>
      {status && (
        <div className="mt-3">
          <p className="text-sm">{status}</p>
          {busy && (
            <div className="mx-auto mt-2 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-line">
              <div className="h-full bg-brand transition-all" style={{ width: `${percent}%` }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
