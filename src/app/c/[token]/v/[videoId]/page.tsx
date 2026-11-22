import Link from "next/link";
import { notFound } from "next/navigation";
import Logo from "@/components/Logo";
import ReviewRoom from "@/components/ReviewRoom";
import { mintViewerToken, permsFor } from "@/lib/access";
import { episodesIn, personCanSeeVideo, visibleChain } from "@/lib/folders";
import { getPersonByToken, getVideo, listFolders, listStack, listVideos } from "@/lib/repo";

export default async function ClientWatch({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; videoId: string }>;
  searchParams: Promise<{ autoplay?: string }>;
}) {
  const { token, videoId } = await params;
  const { autoplay } = await searchParams;
  const person = await getPersonByToken(token);
  const video = await getVideo(videoId);
  if (!person || !video) notFound();
  const [folders, allVideos] = await Promise.all([listFolders(), listVideos()]);
  // Must be a real person AND the video must be shared with them (directly or through a folder).
  if (!personCanSeeVideo(person.id, folders, video)) notFound();

  const role = person.kind; // "client" | "guest"
  const perms = permsFor(role, video);
  const viewerToken = await mintViewerToken(video, { role, name: person.name });
  const versions = (await listStack(video.stackId)).filter((v) => personCanSeeVideo(person.id, folders, v));

  // The other videos in this folder, in play order (only ones this person can see).
  const items = video.folderId
    ? episodesIn(allVideos, video.folderId)
        .filter((v) => personCanSeeVideo(person.id, folders, v))
        .map((v) => ({ id: v.id, stackId: v.stackId, title: v.title, href: `/c/${token}/v/${v.id}` }))
    : [];
  const current = items.find((i) => i.stackId === video.stackId);

  const chain = video.folderId ? visibleChain(person.id, folders, video.folderId) : [];
  const back = chain.length ? { href: `/c/${token}/f/${chain[chain.length - 1].id}`, label: `← ${chain[chain.length - 1].name}` } : { href: `/c/${token}`, label: "← All videos" };

  return (
    <>
      <header className="border-b border-line lg:pr-[380px]">
        <div className="mx-auto flex max-w-[2200px] items-center gap-4 px-4 py-3">
          <Logo height={38} />
          <Link href={back.href} className="ml-auto text-sm text-cream/60 hover:text-cream">{back.label}</Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[2200px] flex-1 px-4 py-6 lg:pr-[380px]">
        <ReviewRoom
          key={video.id}
          token={viewerToken}
          videoId={video.id}
          title={video.title}
          fps={video.fps}
          viewerName={person.name}
          role={role}
          watermarkName={perms.watermark ? person.name : null}
          canDownload={perms.download}
          versions={versions.map((v) => ({ id: v.id, label: `v${v.version}`, href: `/c/${token}/v/${v.id}` }))}
          nav={items.length > 1 && current ? { items: items.map(({ id, title, href }) => ({ id, title, href })), currentId: current.id } : null}
          autoPlay={autoplay === "1"}
        />
      </main>
    </>
  );
}
