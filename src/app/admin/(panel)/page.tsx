import Link from "next/link";
import VideoUploader from "@/components/admin/VideoUploader";
import { listPeople, listVideos } from "@/lib/repo";
import { requireAdminPage } from "@/lib/session";
import type { Video } from "@/lib/types";

export default async function AdminHome() {
  await requireAdminPage();
  const [videos, people] = await Promise.all([listVideos(), listPeople()]);

  // One card per version stack, showing the newest version.
  const stacks = new Map<string, Video[]>();
  for (const v of videos) stacks.set(v.stackId, [...(stacks.get(v.stackId) ?? []), v]);
  const cards = [...stacks.values()]
    .map((vs) => vs.sort((a, b) => b.version - a.version))
    .sort((a, b) => b[0].createdAt - a[0].createdAt);

  const names = new Map(people.map((p) => [p.id, p.name]));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <VideoUploader />
      {cards.length === 0 ? (
        <p className="py-10 text-center text-stone">No videos yet. Upload your first cut above.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(([latest, ...older]) => (
            <Link key={latest.id} href={`/admin/videos/${latest.id}`} className="card block overflow-hidden transition hover:border-brand">
              <div className="grid aspect-video place-items-center bg-gradient-to-br from-magenta/40 via-ink to-brand/40">
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
          ))}
        </div>
      )}
    </div>
  );
}
