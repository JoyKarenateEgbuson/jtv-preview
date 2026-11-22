import { FolderCards, VideoCards } from "@/components/admin/AdminGrids";
import VideoUploader from "@/components/admin/VideoUploader";
import { listFolders, listPeople, listVideos } from "@/lib/repo";
import { requireAdminPage } from "@/lib/session";

export default async function AdminHome() {
  await requireAdminPage();
  const [folders, videos, people] = await Promise.all([listFolders(), listVideos(), listPeople()]);

  const topFolders = folders.filter((f) => !f.parentId);
  const looseVideos = videos.filter((v) => !v.folderId);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <VideoUploader />
      {topFolders.length === 0 && looseVideos.length === 0 ? (
        <p className="py-10 text-center text-stone">No videos yet. Upload your first cut above, or a whole folder.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FolderCards folders={topFolders} allFolders={folders} videos={videos} people={people} afterDelete="/admin" />
          <VideoCards videos={looseVideos} people={people} />
        </div>
      )}
    </div>
  );
}
