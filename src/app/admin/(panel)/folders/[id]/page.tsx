import Link from "next/link";
import { notFound } from "next/navigation";
import { FolderCards, VideoCards } from "@/components/admin/AdminGrids";
import FolderMenu from "@/components/admin/FolderMenu";
import FolderTools from "@/components/admin/FolderTools";
import ShareLinks from "@/components/admin/ShareLinks";
import VideoUploader from "@/components/admin/VideoUploader";
import { descendantIds, folderChain, latestPerStack } from "@/lib/folders";
import { listFolderLinks, listFolders, listPeople, listVideos } from "@/lib/repo";
import { requireAdminPage } from "@/lib/session";

export default async function AdminFolderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const [folders, videos, people, links] = await Promise.all([
    listFolders(),
    listVideos(),
    listPeople(),
    listFolderLinks(id),
  ]);
  const folder = folders.find((f) => f.id === id);
  if (!folder) notFound();

  const chain = folderChain(folders, id);
  const children = folders.filter((f) => f.parentId === id);
  const here = videos.filter((v) => v.folderId === id);
  const ids = descendantIds(folders, id);
  const inside = videos.filter((v) => v.folderId && ids.includes(v.folderId));
  const names = new Map(people.map((p) => [p.id, p.name]));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-cream/60" aria-label="Breadcrumb">
        <Link href="/admin" className="hover:text-cream">All videos</Link>
        {chain.map((f, i) => (
          <span key={f.id} className="flex items-center gap-1.5">
            <span>›</span>
            {i === chain.length - 1 ? (
              <span className="text-cream">{f.name}</span>
            ) : (
              <Link href={`/admin/folders/${f.id}`} className="hover:text-cream">{f.name}</Link>
            )}
          </span>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{folder.name}</h1>
        <span className="text-sm text-stone">
          {folder.personIds.length
            ? `Shared with ${folder.personIds.map((p) => names.get(p) ?? "?").join(", ")}`
            : "Not shared with a client yet"}
        </span>
        <div className="ml-auto">
          <FolderMenu
            folder={folder}
            people={people}
            counts={{ videos: inside.length, folders: ids.length - 1 }}
            afterDelete={folder.parentId ? `/admin/folders/${folder.parentId}` : "/admin"}
            alwaysVisible
          />
        </div>
      </div>

      <VideoUploader folderId={id} label="Upload videos here" />
      <FolderTools folderId={id} videoCount={latestPerStack(inside).length} />

      {children.length === 0 && here.length === 0 ? (
        <p className="py-8 text-center text-stone">This folder is empty. Upload videos or a folder above.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FolderCards
            folders={children}
            allFolders={folders}
            videos={videos}
            people={people}
            afterDelete={`/admin/folders/${id}`}
          />
          <VideoCards videos={here} people={people} />
        </div>
      )}

      <ShareLinks folderId={id} links={links} />
    </div>
  );
}
