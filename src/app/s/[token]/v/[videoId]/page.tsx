import { notFound } from "next/navigation";
import ReviewRoom from "@/components/ReviewRoom";
import { ShareGateScreen, ShareHeader } from "@/components/ShareChrome";
import { mintViewerToken, permsFor } from "@/lib/access";
import { episodesIn, linkAllowsVideo } from "@/lib/folders";
import { getVideo, listFolders, listVideos } from "@/lib/repo";
import { shareGate } from "@/lib/share";

// A video inside a folder share link. It must belong to the link's folder (or below).
export default async function ShareVideo({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; videoId: string }>;
  searchParams: Promise<{ autoplay?: string }>;
}) {
  const { token, videoId } = await params;
  const { autoplay } = await searchParams;
  const gate = await shareGate(token);
  if (gate.state === "missing") notFound();
  if (gate.state !== "ok") return <ShareGateScreen state={gate.state} token={token} />;
  const { link, name } = gate;

  const video = await getVideo(videoId);
  if (!video) notFound();
  const [folders, allVideos] = await Promise.all([listFolders(), listVideos()]);
  if (!linkAllowsVideo(link, folders, video)) notFound();

  const perms = permsFor("guest", video);
  const viewerToken = await mintViewerToken(video, { role: "guest", name });

  const items = video.folderId
    ? episodesIn(allVideos, video.folderId)
        .filter((v) => linkAllowsVideo(link, folders, v))
        .map((v) => ({ id: v.id, stackId: v.stackId, title: v.title, href: `/s/${token}/v/${v.id}` }))
    : [];
  const current = items.find((i) => i.stackId === video.stackId);
  const backHref = !video.folderId || video.folderId === link.folderId ? `/s/${token}` : `/s/${token}/f/${video.folderId}`;

  return (
    <>
      <ShareHeader token={token} name={name} backHref={backHref} reserveRight />
      <main className="mx-auto w-full max-w-[2200px] flex-1 px-4 py-6 lg:pr-[380px]">
        <ReviewRoom
          key={video.id}
          token={viewerToken}
          videoId={video.id}
          title={video.title}
          fps={video.fps}
          viewerName={name}
          role="guest"
          watermarkName={perms.watermark ? name : null}
          canDownload={false}
          versions={[]}
          nav={items.length > 1 && current ? { items: items.map(({ id, title, href }) => ({ id, title, href })), currentId: current.id } : null}
          autoPlay={autoplay === "1"}
        />
      </main>
    </>
  );
}
