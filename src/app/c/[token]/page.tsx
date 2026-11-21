import Link from "next/link";
import { notFound } from "next/navigation";
import Logo from "@/components/Logo";
import { getPersonByToken, listVideos } from "@/lib/repo";
import type { Video } from "@/lib/types";

// A client's private page: everything shared with them, newest version of each piece.
export default async function ClientPortal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const person = await getPersonByToken(token);
  if (!person) notFound();

  const mine = (await listVideos()).filter((v) => v.personIds.includes(person.id));
  const stacks = new Map<string, Video[]>();
  for (const v of mine) stacks.set(v.stackId, [...(stacks.get(v.stackId) ?? []), v]);
  const cards = [...stacks.values()]
    .map((vs) => vs.sort((a, b) => b.version - a.version))
    .sort((a, b) => b[0].createdAt - a[0].createdAt);

  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-3"><Logo height={40} /></div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold">Hi {person.name} 👋</h1>
        <p className="mt-1 text-cream/70">Here&apos;s what&apos;s ready for you to watch.</p>

        {cards.length === 0 ? (
          <p className="py-16 text-center text-stone">Nothing has been shared with you yet.</p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map(([latest, ...older]) => (
              <Link key={latest.id} href={`/c/${token}/v/${latest.id}`} className="card block overflow-hidden transition hover:border-brand">
                <div className="grid aspect-video place-items-center bg-gradient-to-br from-magenta/40 via-ink to-brand/40">
                  <svg viewBox="0 0 24 24" className="h-12 w-12 fill-cream/90"><path d="M8 5v14l11-7z" /></svg>
                </div>
                <div className="p-4">
                  <p className="truncate font-semibold">{latest.title}</p>
                  <p className="mt-1 text-xs text-stone">
                    Version {latest.version}
                    {older.length > 0 && ` · ${older.length} earlier`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
