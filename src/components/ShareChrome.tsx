import Link from "next/link";
import ChangeName from "./ChangeName";
import Logo from "./Logo";
import NamePrompt from "./NamePrompt";

/** Header for share-link pages: logo on the left, "Viewing as … · Change" on the right. */
export function ShareHeader({ token, name, backHref, reserveRight }: { token: string; name: string; backHref?: string; reserveRight?: boolean }) {
  return (
    <header className={`border-b border-line ${reserveRight ? "lg:pr-[380px]" : ""}`}>
      <div className="mx-auto flex max-w-[2200px] items-center gap-4 px-4 py-3">
        <Logo height={38} />
        {backHref && <Link href={backHref} className="text-sm text-cream/60 hover:text-cream">← Back</Link>}
        <div className="ml-auto"><ChangeName token={token} name={name} /></div>
      </div>
    </header>
  );
}

/** What to show instead of the page when a link has expired or the viewer still has to give their name. */
export function ShareGateScreen({ state, token }: { state: "expired" | "needname"; token: string }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <Logo height={72} />
      {state === "expired" ? (
        <>
          <h1 className="text-xl font-bold">This link has expired</h1>
          <p className="text-cream/70">Ask The Joie TV for a fresh one.</p>
        </>
      ) : (
        <NamePrompt token={token} />
      )}
    </main>
  );
}
