"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Asks a share-link viewer for their name once; it goes on the watermark and comments. */
export default function NamePrompt({ token }: { token: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/share/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name }),
    });
    if (!res.ok) return setError("Please enter your name");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card mx-auto w-full max-w-sm space-y-3 p-6">
      <h1 className="text-lg font-bold">Who&apos;s watching?</h1>
      <p className="text-sm text-cream/70">
        Your name appears on the video as a watermark and on any comments you leave.
      </p>
      <input className="field" autoFocus placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button className="btn w-full" disabled={!name.trim()}>Continue</button>
    </form>
  );
}
