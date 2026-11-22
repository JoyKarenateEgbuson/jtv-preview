import { notFound } from "next/navigation";
import FolderBrowser from "@/components/FolderBrowser";
import { ShareHeader } from "@/components/ShareChrome";
import { descendantIds, episodesIn, latestPerStack, linkAllowsFolder, linkChain, natural } from "@/lib/folders";
import { listFolders, listVideos } from "@/lib/repo";
import type { ShareLink } from "@/lib/types";

/** A folder (or subfolder) opened through a share link. The link can only reach its own folder and below. */
export default async function ShareFolderPage({
  token,
  link,
  name,
  folderId,
}: {
  token: string;
  link: ShareLink;
  name: string;
  folderId: string;
}) {
  const [folders, videos] = await Promise.all([listFolders(), listVideos()]);
  const folder = folders.find((f) => f.id === folderId);
  if (!folder || !linkAllowsFolder(link, folders, folderId)) notFound();

  const hrefFor = (id: string) => (id === link.folderId ? `/s/${token}` : `/s/${token}/f/${id}`);
  const chain = linkChain(link, folders, folderId);
  const children = folders.filter((f) => f.parentId === folderId).sort((a, b) => natural(a.name, b.name));
  const countIn = (id: string) => {
    const ids = descendantIds(folders, id);
    return latestPerStack(videos.filter((v) => v.folderId && ids.includes(v.folderId))).length;
  };

  return (
    <>
      <ShareHeader token={token} name={name} />
      <FolderBrowser
        crumbs={chain.length > 1 ? chain.map((f) => ({ name: f.name, href: hrefFor(f.id) })) : []}
        title={folder.name}
        subtitle={folderId === link.folderId ? "Choose a video to watch and leave your comments." : undefined}
        folders={children.map((f) => ({ id: f.id, name: f.name, videos: countIn(f.id), href: hrefFor(f.id) }))}
        videos={episodesIn(videos, folderId).map((v) => ({
          id: v.id,
          title: v.title,
          versions: v.version,
          href: `/s/${token}/v/${v.id}`,
        }))}
        empty="This folder is empty for now."
      />
    </>
  );
}
