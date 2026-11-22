import Link from "next/link";

export type Crumb = { name: string; href: string };
export type BrowserFolder = { id: string; name: string; videos: number; href: string };
export type BrowserVideo = { id: string; title: string; versions: number; href: string };

/** What clients and link-holders see: a breadcrumb, then folders and videos as cards. */
export default function FolderBrowser({
  crumbs,
  title,
  subtitle,
  folders,
  videos,
  empty,
}: {
  crumbs: Crumb[];
  title: string;
  subtitle?: string;
  folders: BrowserFolder[];
  videos: BrowserVideo[];
  empty: string;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      {crumbs.length > 0 && (
        <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-sm text-cream/60" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <span key={c.href} className="flex items-center gap-1.5">
              {i > 0 && <span>›</span>}
              {i === crumbs.length - 1 ? <span className="text-cream">{c.name}</span> : <Link href={c.href} className="hover:text-cream">{c.name}</Link>}
            </span>
          ))}
        </nav>
      )}
      <h1 className="text-2xl font-bold">{title}</h1>
      {subtitle && <p className="mt-1 text-cream/70">{subtitle}</p>}

      {folders.length === 0 && videos.length === 0 ? (
        <p className="py-16 text-center text-stone">{empty}</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {folders.map((f) => (
            <Link key={f.id} href={f.href} className="card block overflow-hidden transition hover:border-brand">
              <div className="grid aspect-video place-items-center bg-gradient-to-br from-brand/25 via-black to-magenta/25">
                <svg viewBox="0 0 24 24" className="h-14 w-14 fill-cream/85">
                  <path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z" />
                </svg>
              </div>
              <div className="p-4">
                <p className="truncate font-semibold">{f.name}</p>
                <p className="mt-1 text-xs text-stone">Folder · {f.videos} video{f.videos === 1 ? "" : "s"}</p>
              </div>
            </Link>
          ))}
          {videos.map((v) => (
            <Link key={v.id} href={v.href} className="card block overflow-hidden transition hover:border-brand">
              <div className="grid aspect-video place-items-center bg-gradient-to-br from-magenta/40 via-black to-brand/40">
                <svg viewBox="0 0 24 24" className="h-12 w-12 fill-cream/90"><path d="M8 5v14l11-7z" /></svg>
              </div>
              <div className="p-4">
                <p className="truncate font-semibold">{v.title}</p>
                <p className="mt-1 text-xs text-stone">Version {v.versions}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
