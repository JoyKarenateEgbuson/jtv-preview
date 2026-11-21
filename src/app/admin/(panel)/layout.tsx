import Link from "next/link";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/admin/LogoutButton";
import Logo from "@/components/Logo";
import { dbMode, storageMode } from "@/lib/config";
import { isAdmin } from "@/lib/session";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect("/admin/login");
  const local = storageMode() === "local" || dbMode() === "local";

  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[2200px] items-center gap-5 px-4 py-3">
          <Link href="/admin"><Logo height={38} /></Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/admin" className="hover:text-brand">Videos</Link>
            <Link href="/admin/people" className="hover:text-brand">Clients</Link>
          </nav>
          <div className="ml-auto"><LogoutButton /></div>
        </div>
        {local && (
          <div className="bg-sun px-4 py-1.5 text-center text-xs font-semibold text-ink">
            Dev mode: {storageMode() === "local" && "videos are stored on this computer"}
            {storageMode() === "local" && dbMode() === "local" && " and "}
            {dbMode() === "local" && "data is in a local file"}. Connect Google to go live (see docs/SETUP.md).
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-[2200px] flex-1 px-4 py-6">{children}</main>
    </>
  );
}
