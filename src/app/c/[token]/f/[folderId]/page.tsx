import { notFound } from "next/navigation";
import FolderBrowser from "@/components/FolderBrowser";
import Logo from "@/components/Logo";
import { descendantIds, episodesIn, latestPerStack, natural, personCanSeeFolder, visibleChain } from "@/lib/folders";
import { getPersonByToken, listFolders, listVideos } from "@/lib/repo";

// A folder shared with a client: its subfolders and videos. Only folders the client was given are reachable.
export default async function ClientFolder({ params }: { params: Promise<{ token: string; folderId: string }> }) {
  const { token, folderId } = await params;
  const person = await getPersonByToken(token);
  if (!person) notFound();
  const [folders, videos] = await Promise.all([listFolders(), listVideos()]);
  const folder = folders.find((f) => f.id === folderId);
  if (!folder || !personCanSeeFolder(person.id, folders, folderId)) notFound();

  const chain = visibleChain(person.id, folders, folderId);
  const children = folders.filter((f) => f.parentId === folderId).sort((a, b) => natural(a.name, b.name));
  const countIn = (id: string) => {
    const ids = descendantIds(folders, id);
    return latestPerStack(videos.filter((v) => v.folderId && ids.includes(v.folderId))).length;
  };

  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-3"><Logo height={40} /></div>
      </header>
      <FolderBrowser
        crumbs={[
          { name: "Home", href: `/c/${token}` },
          ...chain.map((f) => ({ name: f.name, href: `/c/${token}/f/${f.id}` })),
        ]}
        title={folder.name}
        folders={children.map((f) => ({ id: f.id, name: f.name, videos: countIn(f.id), href: `/c/${token}/f/${f.id}` }))}
        videos={episodesIn(videos, folderId).map((v) => ({
          id: v.id,
          title: v.title,
          versions: v.version,
          href: `/c/${token}/v/${v.id}`,
        }))}
        empty="This folder is empty for now."
      />
    </>
  );
}
