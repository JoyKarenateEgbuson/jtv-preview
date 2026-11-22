import { descendantIds } from "@/lib/folders";
import { deleteFolderTree, getFolder, listFolders, listPeople, listVideos, updateFolder, updateVideo } from "@/lib/repo";
import { adminDenied } from "@/lib/session";
import { removeFile } from "@/lib/storage";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await adminDenied();
  if (denied) return denied;
  const { id } = await ctx.params;
  const folder = await getFolder(id);
  if (!folder) return Response.json({ error: "Not found" }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as {
    name?: string;
    personIds?: unknown;
    parentId?: string | null;
    applyToVideos?: { watermark?: boolean; allowDownload?: boolean };
  };
  const all = await listFolders();

  const patch: { name?: string; personIds?: string[]; parentId?: string | null } = {};
  if (typeof b.name === "string" && b.name.trim()) patch.name = b.name.trim().slice(0, 120);

  if (Array.isArray(b.personIds) && b.personIds.every((p) => typeof p === "string")) {
    const known = new Set((await listPeople()).map((p) => p.id));
    patch.personIds = (b.personIds as string[]).filter((p) => known.has(p));
  }

  if (b.parentId !== undefined) {
    const parentId = b.parentId || null;
    // A folder can't be moved into itself or into one of its own subfolders.
    if (parentId && descendantIds(all, id).includes(parentId)) {
      return Response.json({ error: "A folder can't be moved inside itself" }, { status: 400 });
    }
    if (parentId && !all.some((f) => f.id === parentId)) {
      return Response.json({ error: "Destination folder not found" }, { status: 400 });
    }
    patch.parentId = parentId;
  }

  if (Object.keys(patch).length) await updateFolder(id, patch);

  // "Apply to every video in this folder" (including subfolders).
  let updatedVideos = 0;
  if (b.applyToVideos) {
    const ids = descendantIds(all, id);
    const videoPatch: { watermark?: boolean; allowDownload?: boolean } = {};
    if (typeof b.applyToVideos.watermark === "boolean") videoPatch.watermark = b.applyToVideos.watermark;
    if (typeof b.applyToVideos.allowDownload === "boolean") videoPatch.allowDownload = b.applyToVideos.allowDownload;
    if (Object.keys(videoPatch).length) {
      for (const v of (await listVideos()).filter((v) => v.folderId && ids.includes(v.folderId))) {
        await updateVideo(v.id, videoPatch);
        updatedVideos++;
      }
    }
  }

  return Response.json({ ...(await getFolder(id)), updatedVideos });
}

// Deletes the folder AND everything inside it (subfolders, videos, their files in Drive, comments, links).
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await adminDenied();
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!(await getFolder(id))) return Response.json({ error: "Not found" }, { status: 404 });
  const removed = await deleteFolderTree(id);
  // The files go to Drive's Trash (recoverable for 30 days). Count any that could not be moved.
  let filesNotTrashed = 0;
  for (const v of removed) {
    try {
      await removeFile(v);
    } catch {
      filesNotTrashed++;
    }
  }
  return Response.json({ ok: true, videosDeleted: removed.length, filesNotTrashed });
}
