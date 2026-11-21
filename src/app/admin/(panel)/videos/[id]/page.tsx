import Link from "next/link";
import { notFound } from "next/navigation";
import ShareLinks from "@/components/admin/ShareLinks";
import VideoSettings from "@/components/admin/VideoSettings";
import VideoUploader from "@/components/admin/VideoUploader";
import ReviewRoom from "@/components/ReviewRoom";
import { mintViewerToken, permsFor } from "@/lib/access";
import { adminName } from "@/lib/config";
import { getVideo, listLinks, listPeople, listStack } from "@/lib/repo";
import { requireAdminPage } from "@/lib/session";

export default async function AdminVideoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const video = await getVideo(id);
  if (!video) notFound();

  const [people, links, stack] = await Promise.all([listPeople(), listLinks(id), listStack(video.stackId)]);
  const name = adminName();
  const token = await mintViewerToken(video, { role: "admin", name });
  const perms = permsFor("admin", video);

  return (
    <div className="space-y-8">
      <Link href="/admin" className="text-sm text-cream/60 hover:text-cream">← All videos</Link>

      <ReviewRoom
        token={token}
        videoId={video.id}
        title={video.title}
        fps={video.fps}
        viewerName={name}
        role="admin"
        watermarkName={video.watermark ? name : null}
        canDownload={perms.download}
        versions={stack.map((v) => ({ id: v.id, label: `v${v.version}`, href: `/admin/videos/${v.id}` }))}
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
