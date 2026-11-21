"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

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

/** Uploads one or more videos. With `stackId` it adds a new version of that video. */
export default function VideoUploader({ stackId, label = "Upload videos" }: { stackId?: string; label?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [percent, setPercent] = useState(0);
  const [busy, setBusy] = useState(false);

  async function uploadOne(file: File, n: number, total: number) {
    const prefix = total > 1 ? `(${n}/${total}) ` : "";
    setStatus(`${prefix}Preparing ${file.name}…`);
    setPercent(0);
    const mimeType = file.type || "video/mp4";

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

  async function onPick(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const list = Array.from(files);
      for (let i = 0; i < list.length; i++) await uploadOne(list[i], i + 1, list.length);
      setStatus("Done ✓");
      router.refresh();
    } catch (e) {
      setStatus(`Failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div
      className="rounded-xl border-2 border-dashed border-line p-5 text-center"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (!busy) void onPick(e.dataTransfer.files);
      }}
    >
      <input
        ref={input}
        type="file"
        accept="video/*"
        multiple={!stackId}
        hidden
        onChange={(e) => void onPick(e.target.files)}
      />
      <button type="button" className="btn" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Uploading…" : label}
      </button>
      <p className="mt-2 text-xs text-stone">or drag and drop. Use an H.264 MP4 export so it plays in every browser.</p>
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
