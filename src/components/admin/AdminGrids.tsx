import Link from "next/link";
import { descendantIds, latestPerStack, natural } from "@/lib/folders";
import type { Folder, Person, Video } from "@/lib/types";
import Reveal from "../Reveal";
import FolderMenu from "./FolderMenu";

/** Folder cards (with their "⋮" menu). `folders` are the ones to show; `allFolders` is for counting what's inside. */
export function FolderCards({
  folders,
  allFolders,
  videos,
  people,
  afterDelete,
}: {
  folders: Folder[];
  allFolders: Folder[];
  videos: Video[];
  people: Person[];
  afterDelete: string;
}) {
  const names = new Map(people.map((p) => [p.id, p.name]));
  const sorted = [...folders].sort((a, b) => natural(a.name, b.name));
  return (
    <>
      {sorted.map((f, i) => {
        const ids = descendantIds(allFolders, f.id);
        const inside = videos.filter((v) => v.folderId && ids.includes(v.folderId));
        const episodes = latestPerStack(inside).length;
        const subfolders = ids.length - 1;
        return (
          <Reveal key={f.id} delay={(i % 6) * 70}>
            <div className="group relative">
              <Link href={`/admin/folders/${f.id}`} className="card lift block overflow-hidden hover:border-brand">
                <div className="grid aspect-video place-items-center bg-gradient-to-br from-brand/25 via-black to-magenta/25">
                  <div className="text-center">
                    <svg viewBox="0 0 24 24" className="mx-auto h-14 w-14 fill-cream/85">
                      <path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z" />
                    </svg>
                    <span className="mt-1 block text-sm font-bold">{episodes} video{episodes === 1 ? "" : "s"}</span>
                  </div>
                </div>
                <div className="p-4">
                  <p className="truncate font-semibold">{f.name}</p>
                  <p className="mt-1 truncate text-xs text-stone">
                    Folder{subfolders > 0 && ` · ${subfolders} subfolder${subfolders === 1 ? "" : "s"}`} ·{" "}
                    {f.personIds.length ? `shared with ${f.personIds.map((id) => names.get(id) ?? "?").join(", ")}` : "not shared yet"}
                  </p>
                </div>
              </Link>
              <div className="absolute right-2 top-2 z-10">
                <FolderMenu
                  folder={f}
                  people={people}
                  counts={{ videos: inside.length, folders: subfolders }}
                  afterDelete={afterDelete}
                />
              </div>
            </div>
          </Reveal>
        );
      })}
    </>
  );
}

/** Video cards: one per piece, showing its newest version. */
export function VideoCards({ videos, people }: { videos: Video[]; people: Person[] }) {
  const names = new Map(people.map((p) => [p.id, p.name]));
  const stacks = new Map<string, Video[]>();
  for (const v of videos) stacks.set(v.stackId, [...(stacks.get(v.stackId) ?? []), v]);
  const cards = [...stacks.values()]
    .map((vs) => vs.sort((a, b) => b.version - a.version))
    .sort((a, b) => natural(a[0].title, b[0].title));
  return (
    <>
      {cards.map(([latest, ...older], i) => (
        <Reveal key={latest.id} delay={(i % 6) * 70}>
          <Link href={`/admin/videos/${latest.id}`} className="card lift block overflow-hidden hover:border-brand">
            <div className="grid aspect-video place-items-center bg-gradient-to-br from-magenta/40 via-black to-brand/40">
              <span className="rounded-full bg-black/50 px-3 py-1 text-sm font-bold">v{latest.version}</span>
            </div>
            <div className="p-4">
              <p className="truncate font-semibold">{latest.title}</p>
              <p className="mt-1 text-xs text-stone">
                {older.length + 1} version{older.length ? "s" : ""} ·{" "}
                {latest.personIds.length
                  ? `shared with ${latest.personIds.map((id) => names.get(id) ?? "?").join(", ")}`
                  : "not shared yet"}
              </p>
              <p className="mt-2 flex gap-2 text-[11px]">
                <span className={`rounded px-1.5 py-0.5 ${latest.watermark ? "bg-brand/20 text-brand" : "bg-line text-stone"}`}>
                  watermark {latest.watermark ? "on" : "off"}
                </span>
                <span className={`rounded px-1.5 py-0.5 ${latest.allowDownload ? "bg-sun/20 text-sun" : "bg-line text-stone"}`}>
                  download {latest.allowDownload ? "on" : "off"}
                </span>
              </p>
            </div>
          </Link>
        </Reveal>
      ))}
    </>
  );
}
