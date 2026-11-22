import { createFolder, getFolder } from "@/lib/repo";
import { adminDenied } from "@/lib/session";

// Creates a folder. If one with the same name already exists in the same place, that one is
// returned, so uploading more episodes into "Podcast" adds to it instead of making a copy.
export async function POST(req: Request) {
  const denied = await adminDenied();
  if (denied) return denied;
  const b = (await req.json().catch(() => ({}))) as { name?: string; parentId?: string | null };
  const name = (b.name ?? "").trim().slice(0, 120);
  if (!name) return Response.json({ error: "Folder name is required" }, { status: 400 });
  const parentId = b.parentId || null;
  if (parentId && !(await getFolder(parentId))) {
    return Response.json({ error: "Parent folder not found" }, { status: 400 });
  }
  return Response.json(await createFolder(name, parentId), { status: 201 });
}
