import Link from "next/link";
import Logo from "@/components/Logo";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <Logo height={48} />
      <h1 className="text-2xl font-bold">Reviews</h1>
      <p className="max-w-sm text-cream/70">
        This is a private review portal. If you were sent a link, open it directly.
      </p>
      <Link href="/admin" className="text-sm text-cream/50 underline hover:text-cream">Team sign in</Link>
    </main>
  );
}
