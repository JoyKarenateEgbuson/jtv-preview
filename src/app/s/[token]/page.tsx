import { notFound } from "next/navigation";
import ReviewRoom from "@/components/ReviewRoom";
import { ShareGateScreen, ShareHeader } from "@/components/ShareChrome";
import ShareFolderPage from "@/components/ShareFolderPage";
import { mintViewerToken, permsFor } from "@/lib/access";
import { getVideo } from "@/lib/repo";
import { shareGate } from "@/lib/share";

// A share link: either one video, or a whole folder. Viewers are always "guests"
// (watermark on, no download) and can set their own name.
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const gate = await shareGate(token);
  if (gate.state === "missing") notFound();
  if (gate.state !== "ok") return <ShareGateScreen state={gate.state} token={token} />;
  const { link, name } = gate;

  if (link.folderId) return <ShareFolderPage token={token} link={link} name={name} folderId={link.folderId} />;

  const video = await getVideo(link.videoId);
  if (!video) notFound();
  const perms = permsFor("guest", video);
  const viewerToken = await mintViewerToken(video, { role: "guest", name });

  return (
    <>
      <ShareHeader token={token} name={name} reserveRight />
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
        />
      </main>
    </>
  );
}
