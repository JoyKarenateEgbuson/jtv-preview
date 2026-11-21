import Link from "next/link";
import { notFound } from "next/navigation";
import Logo from "@/components/Logo";
import ReviewRoom from "@/components/ReviewRoom";
import { mintViewerToken, permsFor } from "@/lib/access";
import { getPersonByToken, getVideo, listStack } from "@/lib/repo";

export default async function ClientWatch({ params }: { params: Promise<{ token: string; videoId: string }> }) {
  const { token, videoId } = await params;
  const person = await getPersonByToken(token);
  const video = await getVideo(videoId);
  // Must be a real person AND the video must be shared with them.
  if (!person || !video || !video.personIds.includes(person.id)) notFound();

  const role = person.kind; // "client" | "guest"
  const perms = permsFor(role, video);
  const viewerToken = await mintViewerToken(video, { role, name: person.name });
  const versions = (await listStack(video.stackId)).filter((v) => v.personIds.includes(person.id));

  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[2200px] items-center gap-4 px-4 py-3">
          <Logo height={38} />
          <Link href={`/c/${token}`} className="ml-auto text-sm text-cream/60 hover:text-cream">← All videos</Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[2200px] flex-1 px-4 py-6">
        <ReviewRoom
          token={viewerToken}
          videoId={video.id}
          title={video.title}
          fps={video.fps}
          viewerName={person.name}
          role={role}
          watermarkName={perms.watermark ? person.name : null}
          canDownload={perms.download}
          versions={versions.map((v) => ({ id: v.id, label: `v${v.version}`, href: `/c/${token}/v/${v.id}` }))}
        />
      </main>
    </>
  );
}
