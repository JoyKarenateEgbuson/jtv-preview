import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Logo from "@/components/Logo";
import NamePrompt from "@/components/NamePrompt";
import ReviewRoom from "@/components/ReviewRoom";
import { mintViewerToken, permsFor } from "@/lib/access";
import { getLinkByToken, getVideo } from "@/lib/repo";
import { isExpired } from "@/lib/time";

// Share link: always a "guest" (watermark on, no download).
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await getLinkByToken(token);
  if (!link) notFound();
  if (isExpired(link.expiresAt)) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <Logo height={72} />
        <h1 className="text-xl font-bold">This link has expired</h1>
        <p className="text-cream/70">Ask The Joie TV for a fresh one.</p>
      </main>
    );
  }
  const video = await getVideo(link.videoId);
  if (!video) notFound();

  const name = link.viewerName || (await cookies()).get(`jtv_name_${link.id}`)?.value || "";
  if (!name) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        <Logo height={72} />
        <NamePrompt token={token} />
      </main>
    );
  }

  const perms = permsFor("guest", video);
  const viewerToken = await mintViewerToken(video, { role: "guest", name });

  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[2200px] items-center px-4 py-3"><Logo height={38} /></div>
      </header>
      <main className="mx-auto w-full max-w-[2200px] flex-1 px-4 py-6">
        <ReviewRoom
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
