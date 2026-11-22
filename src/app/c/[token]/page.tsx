import { notFound } from "next/navigation";
import FolderBrowser from "@/components/FolderBrowser";
import Logo from "@/components/Logo";
import { descendantIds, latestPerStack, looseVideosFor, natural, sharedRootFolders } from "@/lib/folders";
import { getPersonByToken, listFolders, listVideos } from "@/lib/repo";

// A client's private page: the folders shared with them, plus any videos shared one by one.
export default async function ClientPortal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const person = await getPersonByToken(token);
  if (!person) notFound();

  const [folders, videos] = await Promise.all([listFolders(), listVideos()]);
  const roots = sharedRootFolders(person.id, folders).sort((a, b) => natural(a.name, b.name));
  const loose = latestPerStack(looseVideosFor(person.id, folders, videos)).sort((a, b) => natural(a.title, b.title));
  const countIn = (folderId: string) => {
    const ids = descendantIds(folders, folderId);
    return latestPerStack(videos.filter((v) => v.folderId && ids.includes(v.folderId))).length;
  };

  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-3"><Logo height={40} /></div>
      </header>
      <FolderBrowser
        crumbs={[]}
        title={`Hi ${person.name} 👋`}
        subtitle="Here's what's ready for you to watch."
        folders={roots.map((f) => ({ id: f.id, name: f.name, videos: countIn(f.id), href: `/c/${token}/f/${f.id}` }))}
        videos={loose.map((v) => ({ id: v.id, title: v.title, versions: v.version, href: `/c/${token}/v/${v.id}` }))}
        empty="Nothing has been shared with you yet."
      />
    </>
  );
}
