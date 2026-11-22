import Link from "next/link";
import { notFound } from "next/navigation";
import ShareLinks from "@/components/admin/ShareLinks";
import VideoSettings from "@/components/admin/VideoSettings";
import VideoUploader from "@/components/admin/VideoUploader";
import ReviewRoom from "@/components/ReviewRoom";
import { mintViewerToken, permsFor } from "@/lib/access";
import { adminName } from "@/lib/config";
import { episodesIn, folderChain } from "@/lib/folders";
import { getVideo, listFolders, listLinks, listPeople, listStack, listVideos } from "@/lib/repo";
import { requireAdminPage } from "@/lib/session";

export default async function AdminVideoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autoplay?: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const { autoplay } = await searchParams;
  const video = await getVideo(id);
  if (!video) notFound();

  const [people, links, stack, folders, allVideos] = await Promise.all([
    listPeople(),
    listLinks(id),
    listStack(video.stackId),
    listFolders(),
    listVideos(),
  ]);
  const name = adminName();
  const token = await mintViewerToken(video, { role: "admin", name });
  const perms = permsFor("admin", video);

  const chain = folderChain(folders, video.folderId);
  const items = video.folderId
    ? episodesIn(allVideos, video.folderId).map((v) => ({ id: v.id, stackId: v.stackId, title: v.title, href: `/admin/videos/${v.id}` }))
    : [];
  const current = items.find((i) => i.stackId === video.stackId);

  return (
    <div className="space-y-8 lg:pr-[380px]">
      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-cream/60" aria-label="Breadcrumb">
        <Link href="/admin" className="hover:text-cream">All videos</Link>
        {chain.map((f) => (
          <span key={f.id} className="flex items-center gap-1.5">
            <span>›</span>
            <Link href={`/admin/folders/${f.id}`} className="hover:text-cream">{f.name}</Link>
          </span>
        ))}
      </nav>

      <ReviewRoom
        key={video.id}
        token={token}
        videoId={video.id}
        title={video.title}
        fps={video.fps}
        viewerName={name}
        role="admin"
        watermarkName={video.watermark ? name : null}
        canDownload={perms.download}
        versions={stack.map((v) => ({ id: v.id, label: `v${v.version}`, href: `/admin/videos/${v.id}` }))}
        nav={items.length > 1 && current ? { items: items.map(({ id: i, title, href }) => ({ id: i, title, href })), currentId: current.id } : null}
        autoPlay={autoplay === "1"}
      />

      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-2">
        <VideoSettings key={video.id + video.createdAt} video={video} people={people} />
        <div className="space-y-5">
          <ShareLinks videoId={video.id} links={links} />
          <div className="card space-y-3 p-5">
            <h2 className="font-semibold">Upload a new version</h2>
            <p className="text-xs text-stone">
              Adds v{stack.length + 1} to this stack. It inherits the audience and settings, and viewers can switch between versions.
            </p>
            <VideoUploader stackId={video.stackId} label={`Upload v${stack.length + 1}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
